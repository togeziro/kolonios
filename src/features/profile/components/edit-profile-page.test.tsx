// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { navigateMock, updateUserMock, uploadSelfieMock, toastMock, useSessionMock, queryMock } =
  vi.hoisted(() => ({
    navigateMock: vi.fn(),
    updateUserMock: vi.fn(),
    uploadSelfieMock: vi.fn(),
    toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    useSessionMock: vi.fn(),
    queryMock: vi.fn()
  }));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock('sonner', () => ({
  toast: toastMock
}));

vi.mock('@/lib/auth/auth-client', () => ({
  authClient: {
    changePassword: vi.fn(),
    updateUser: updateUserMock
  },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  useSession: useSessionMock
}));

vi.mock('@/lib/storage/upload-client', () => ({
  PHOTO_UPLOAD_FAILED: 'PHOTO_UPLOAD_FAILED',
  uploadSelfie: uploadSelfieMock
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: () => queryMock() };
});

vi.mock('../api/queries', () => ({
  profileKeys: { all: ['profile'], avatar: (key: string) => ['profile', 'avatar', key] },
  avatarUrlQueryOptions: (key: string) => ({
    queryKey: ['profile', 'avatar', key],
    queryFn: vi.fn()
  })
}));

import EditProfilePage from './edit-profile-page';

const sessionUser = {
  name: 'Budi Santoso',
  email: 'budi@example.com',
  image: undefined as string | undefined
};

function renderPage() {
  render(
    <I18nextProvider i18n={i18n}>
      <EditProfilePage />
    </I18nextProvider>
  );
}

beforeEach(() => {
  updateUserMock.mockReset();
  uploadSelfieMock.mockReset();
  navigateMock.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  queryMock.mockReturnValue({ data: undefined });
  useSessionMock.mockReturnValue({ data: { user: sessionUser }, isPending: false });
});

describe('EditProfilePage', () => {
  it('renders all sections with session data and work-info rows', () => {
    renderPage();

    expect(screen.getByText('Personal Information')).toBeTruthy();
    expect(screen.getByText('Work Information')).toBeTruthy();
    const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Budi Santoso');
    expect(screen.getByText('TECH-0042')).toBeTruthy();
    expect(screen.getByText('Field Operations')).toBeTruthy();
    expect(screen.getByText('Senior Technician')).toBeTruthy();
    expect(screen.getByText('BS')).toBeTruthy();
  });

  it('renders the email input disabled with the contact-HR hint', () => {
    renderPage();

    const emailInput = screen.getByLabelText('Email Address') as HTMLInputElement;
    expect(emailInput.value).toBe('budi@example.com');
    expect(emailInput.disabled).toBe(true);
    expect(screen.getByText('Contact HR to change your email')).toBeTruthy();
  });

  it('saves the name through authClient.updateUser and toasts success', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null });
    renderPage();

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Budi Santoso Jr' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ name: 'Budi Santoso Jr' });
    });
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
    });
  });

  it('uploads an avatar through the storage client then updates the session image', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null });
    uploadSelfieMock.mockResolvedValue('attendance/u/9.jpg');
    renderPage();

    const file = new File(['fake-image'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('avatar-file-input'), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(uploadSelfieMock).toHaveBeenCalledWith(expect.any(String), 'attendance');
    });
    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ image: 'attendance/u/9.jpg' });
    });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('falls back to initials without crashing when storage is unconfigured', async () => {
    uploadSelfieMock.mockRejectedValue(new Error('Storage is not configured'));
    renderPage();

    const file = new File(['fake-image'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('avatar-file-input'), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(uploadSelfieMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain("storage isn't available");
    });
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(screen.getByText('BS')).toBeTruthy();
  });

  it('renders a direct avatar url from the session image without resolution', () => {
    useSessionMock.mockReturnValue({
      data: { user: { ...sessionUser, image: 'https://cdn.example.com/me.png' } },
      isPending: false
    });
    renderPage();

    const img = screen.getByAltText('Profile photo') as HTMLImageElement;
    expect(img.src).toBe('https://cdn.example.com/me.png');
  });
});
