import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from '@tanstack/react-router';

import { ShellLayout } from '../components/shell/ShellLayout';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AssetsPage } from '../pages/AssetsPage';
import { ClustersPage } from '../pages/ClustersPage';
import { TemplateLibraryPage } from '../pages/TemplateLibraryPage';
import { AssessmentsPage } from '../pages/AssessmentsPage';
import { AssessmentWizardPage } from '../pages/AssessmentWizardPage';
import { ReviewQueuePage } from '../pages/ReviewQueuePage';
import { RelationshipsPage } from '../pages/RelationshipsPage';
import { SiteMapPage } from '../pages/SiteMapPage';
import { CountermeasuresPage } from '../pages/CountermeasuresPage';
import { useAuthStore } from '../stores/auth';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
});

function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <ShellLayout />;
}

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: RequireAuth,
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: DashboardPage,
});

export const assetsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/assets',
  component: AssetsPage,
  // `?siteId=<uuid>` scopes the list to that asset + its descendants,
  // used when drilling in from a Site Map pin.
  validateSearch: (search: Record<string, unknown>): { siteId?: string } => ({
    siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
  }),
});

const clustersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/clusters',
  component: ClustersPage,
});

const templatesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/templates',
  component: TemplateLibraryPage,
});

const assessmentsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/assessments',
  component: AssessmentsPage,
});

const assessmentWizardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/assessments/$id',
  component: AssessmentWizardPage,
});

const reviewQueueRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/review',
  component: ReviewQueuePage,
});

const relationshipsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/relationships',
  component: RelationshipsPage,
});

const siteMapRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/site-map',
  component: SiteMapPage,
});

const countermeasuresRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/countermeasures',
  component: CountermeasuresPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  protectedRoute.addChildren([
    dashboardRoute,
    assetsRoute,
    clustersRoute,
    templatesRoute,
    assessmentsRoute,
    assessmentWizardRoute,
    reviewQueueRoute,
    relationshipsRoute,
    siteMapRoute,
    countermeasuresRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
