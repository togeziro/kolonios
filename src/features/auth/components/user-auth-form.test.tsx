// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import UserAuthForm from './user-auth-form';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const { emailSignInMock, getSessionMock, toastErrorMock, navigateMock } = vi.hoisted(() => ({
  emailSignInMock: vi.fn(),
  getSessionMock: vi.fn(),
  toastErrorMock: vi.fn(),
  navigateMock: vi.fn()
}));

vi.mock('@/lib/auth/auth-client', () => ({
  authClient: {
    signIn: { email: emailSignInMock },
    getSession: getSessionMock
  }
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock, success: vi.fn() }
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: navigateMock })
}));

function renderForm() {
  const queryClient = new QueryClient();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <UserAuthForm />
      </QueryClientProvider>
    </I18nextProvider>
  );
}

// Chrome autofill / password managers write values straight into the DOM
// without firing React onChange events — simulate exactly that.
function autofill(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  act(() => setter.call(input, value));
}

const loginButton = () => screen.getByRole('button', { name: 'Login' });

beforeEach(() => {
  emailSignInMock.mockReset();
  getSessionMock.mockReset();
  toastErrorMock.mockReset();
  navigateMock.mockReset();
  emailSignInMock.mockResolvedValue({ error: null });
  getSessionMock.mockResolvedValue({ data: { user: { role: 'admin' } } });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UserAuthForm autofill handling', () => {
  it('submits browser-autofilled credentials on the first click', async () => {
    const user = userEvent.setup();
    renderForm();
    autofill('email', 'admin@example.com');
    autofill('password', 'Password123!');
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    // RTL's asyncWrapper drains via a real setTimeout that never fires under
    // fake timers — the autofill debounce above already ran, so go back to
    // real timers before simulating the click.
    vi.useRealTimers();
    await user.click(loginButton());
    expect(emailSignInMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@example.com',
        password: 'Password123!',
        rememberMe: false
      })
    );
  });

  it('keeps autofilled values in the fields after a re-render', async () => {
    const user = userEvent.setup();
    renderForm();
    autofill('email', 'admin@example.com');
    autofill('password', 'Password123!');
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    // See above: userEvent needs real timers (RTL asyncWrapper setTimeout).
    vi.useRealTimers();
    await user.click(screen.getByRole('checkbox'));
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('admin@example.com');
    expect((document.getElementById('password') as HTMLInputElement).value).toBe('Password123!');
  });

  it('shows an error toast and does not call sign-in when fields are empty', async () => {
    const user = userEvent.setup();
    // No timers under test here — userEvent needs real timers (see above).
    vi.useRealTimers();
    renderForm();
    await user.click(loginButton());
    expect(toastErrorMock).toHaveBeenCalled();
    expect(emailSignInMock).not.toHaveBeenCalled();
  });
});

describe('UserAuthForm remember-me checkbox', () => {
  it('renders the remember-me checkbox after the email field', () => {
    renderForm();
    const checkbox = screen.getByRole('checkbox');
    const email = document.getElementById('email') as HTMLInputElement;
    expect(email.compareDocumentPosition(checkbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sends rememberMe when the checkbox is checked', async () => {
    const user = userEvent.setup();
    // Typed values flow through onChange — no debounce timers needed, and
    // userEvent needs real timers (RTL asyncWrapper setTimeout).
    vi.useRealTimers();
    renderForm();
    const email = document.getElementById('email') as HTMLInputElement;
    const password = document.getElementById('password') as HTMLInputElement;
    await user.clear(email);
    await user.type(email, 'admin@example.com');
    await user.clear(password);
    await user.type(password, 'Password123!');
    await user.click(screen.getByRole('checkbox'));
    await user.click(loginButton());
    expect(emailSignInMock).toHaveBeenCalledWith(expect.objectContaining({ rememberMe: true }));
  });
});
