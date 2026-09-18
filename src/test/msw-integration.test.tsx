// @vitest-environment jsdom
// i18n:skip
// UI-integration example: RTL + userEvent + MSW (no vi.mock, no DB).
// Pattern reference for component tests that fetch data:
//   - MSW intercepts at the network layer (`msw/node`)
//   - `server.use()` overrides a handler for one test only
//   - `findBy*` / `waitFor` for async boundaries, `userEvent` for input
import { useEffect, useState } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';

type Product = { id: number; name: string; price: number; inStock: boolean };

function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/demo-products')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json() as Promise<Product[]>;
      })
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading products...</p>;
  if (error) return <p role='alert'>Error: {error}</p>;

  const visible = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <label htmlFor='search'>Search products</label>
      <input id='search' type='text' value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {visible.map((p) => (
          <li key={p.id}>
            {p.name} — ${p.price.toFixed(2)}
            {!p.inStock && <span> (Out of Stock)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ProductList (RTL + MSW)', () => {
  it('renders a loading state initially', () => {
    render(<ProductList />);
    expect(screen.getByText(/loading products/i)).toBeInTheDocument();
  });

  it('renders products returned by the API', async () => {
    render(<ProductList />);
    expect(await screen.findByText(/mechanical keyboard/i)).toBeInTheDocument();
    expect(screen.getByText(/wireless mouse/i)).toBeInTheDocument();
    expect(screen.getByText(/\(Out of Stock\)/i)).toBeInTheDocument();
  });

  it('filters via realistic typing', async () => {
    const user = userEvent.setup();
    render(<ProductList />);
    await screen.findByText(/mechanical keyboard/i);
    await user.type(screen.getByLabelText(/search products/i), 'mouse');
    await waitFor(() => {
      expect(screen.queryByText(/mechanical keyboard/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/wireless mouse/i)).toBeInTheDocument();
  });

  it('renders an error message when the API fails', async () => {
    server.use(
      http.get('/api/demo-products', () => {
        return HttpResponse.json({ message: 'Server Error' }, { status: 500 });
      })
    );
    render(<ProductList />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to fetch/i);
    });
  });
});
