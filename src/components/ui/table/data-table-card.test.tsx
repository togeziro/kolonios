// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTableCard } from './data-table-card';

describe('DataTableCard', () => {
  it('renders header title, description, and action', () => {
    render(
      <DataTableCard title='Users' description='Manage members' action={<button>Add User</button>}>
        <div>table goes here</div>
      </DataTableCard>
    );
    expect(screen.getByText('Users')).toBeTruthy();
    expect(screen.getByText('Manage members')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add User' })).toBeTruthy();
  });

  it('renders children inside card content', () => {
    render(
      <DataTableCard>
        <div>body</div>
      </DataTableCard>
    );
    expect(screen.getByText('body')).toBeTruthy();
  });
});
