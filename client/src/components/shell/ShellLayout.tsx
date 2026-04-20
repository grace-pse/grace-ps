import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';

export function ShellLayout() {
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-n-50">
        <Outlet />
      </main>
    </div>
  );
}
