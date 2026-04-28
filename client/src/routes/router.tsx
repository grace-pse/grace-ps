import { lazy, useEffect } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from '@tanstack/react-router';
import { useAppearanceStore } from '../stores/appearance';

import { ShellLayout } from '../components/shell/ShellLayout';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AssetsPage } from '../pages/AssetsPage';
import { ClustersPage } from '../pages/ClustersPage';
import { AssessmentsPage } from '../pages/AssessmentsPage';
import { ReviewQueuePage } from '../pages/ReviewQueuePage';
import { SiteMapPage } from '../pages/SiteMapPage';
import { CountermeasuresPage } from '../pages/CountermeasuresPage';
import { SurveysPage } from '../pages/SurveysPage';
import { SurveyRunPage } from '../pages/SurveyRunPage';
import { MySurveysPage } from '../pages/MySurveysPage';
import { SurveyTemplatesPage } from '../pages/SurveyTemplatesPage';

// Heavy or rarely-visited pages: load on demand. Saves ~285–365 KB off
// the entry chunk. The Suspense boundary lives in ShellLayout.
const TemplateLibraryPage = lazy(() =>
  import('../pages/TemplateLibraryPage').then((m) => ({ default: m.TemplateLibraryPage })),
);
const AssessmentWizardPage = lazy(() =>
  import('../pages/AssessmentWizardPage').then((m) => ({ default: m.AssessmentWizardPage })),
);
const RelationshipsPage = lazy(() =>
  import('../pages/RelationshipsPage').then((m) => ({ default: m.RelationshipsPage })),
);
const AdminTemplatesPage = lazy(() =>
  import('../pages/AdminTemplatesPage').then((m) => ({ default: m.AdminTemplatesPage })),
);
const AdminSurveyConfigPage = lazy(() =>
  import('../pages/AdminSurveyConfigPage').then((m) => ({ default: m.AdminSurveyConfigPage })),
);
import { SettingsLayout } from '../components/settings/SettingsLayout';
import { AppearanceIndexPage } from '../pages/settings/AppearanceIndexPage';
import { AppearanceAssetRolesPage } from '../pages/settings/AppearanceAssetRolesPage';
import { AppearanceAssetTypesPage } from '../pages/settings/AppearanceAssetTypesPage';
import { AppearanceEdgesPage } from '../pages/settings/AppearanceEdgesPage';
import { AppearanceRiskLevelsPage } from '../pages/settings/AppearanceRiskLevelsPage';
import { UsersAdminPage } from '../pages/settings/UsersAdminPage';
import { OrgGeneralPage } from '../pages/settings/OrgGeneralPage';
import { RolesPage } from '../pages/settings/RolesPage';
import { AboutPage } from '../pages/settings/AboutPage';
import { RequirePermission } from '../components/auth/RequirePermission';
import { useAuthStore } from '../stores/auth';
import { hasPermission } from '../lib/permissions';

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
  const hydrated = useAppearanceStore((s) => s.hydrated);

  useEffect(() => {
    if (token && !hydrated) {
      void useAppearanceStore.getState().hydrate();
    }
  }, [token, hydrated]);

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

const adminTemplatesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/admin/templates',
  component: () => (
    <RequirePermission perm="templates:manage">
      <AdminTemplatesPage />
    </RequirePermission>
  ),
});

const surveysRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/surveys',
  component: SurveysPage,
});

const mySurveysRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/surveys/mine',
  component: MySurveysPage,
});

const surveyRunRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/surveys/$id',
  component: SurveyRunPage,
});

const adminSurveyTemplatesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/admin/survey-templates',
  component: () => (
    <RequirePermission perm="surveys:admin">
      <SurveyTemplatesPage />
    </RequirePermission>
  ),
});

const adminSurveyConfigRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/admin/survey-config',
  component: () => (
    <RequirePermission perm="surveys:admin">
      <AdminSurveyConfigPage />
    </RequirePermission>
  ),
});

// ─── /admin/settings shell ──────────────────────────────────

function SettingsRedirect() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  if (hasPermission(user?.role, 'org:manage')) {
    return <Navigate to="/admin/settings/appearance" replace />;
  }
  if (hasPermission(user?.role, 'users:manage')) {
    return <Navigate to="/admin/settings/users" replace />;
  }
  return <Navigate to="/" replace />;
}

// NOTE: do not add `id` here — TanStack Router rejects routes that have
// both `id` and `path`, which crashes the entire app at load time
// ("Route cannot have both an 'id' and a 'path' option").
const settingsLayoutRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/admin/settings',
  component: SettingsLayout,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/',
  component: SettingsRedirect,
});

const settingsAppearanceIndexRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/appearance',
  component: () => (
    <RequirePermission perm="org:manage">
      <AppearanceIndexPage />
    </RequirePermission>
  ),
});

const settingsAppearanceAssetRolesRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/appearance/asset-roles',
  component: () => (
    <RequirePermission perm="org:manage">
      <AppearanceAssetRolesPage />
    </RequirePermission>
  ),
});

const settingsAppearanceAssetTypesRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/appearance/asset-types',
  component: () => (
    <RequirePermission perm="org:manage">
      <AppearanceAssetTypesPage />
    </RequirePermission>
  ),
});

const settingsAppearanceEdgesRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/appearance/edges',
  component: () => (
    <RequirePermission perm="org:manage">
      <AppearanceEdgesPage />
    </RequirePermission>
  ),
});

const settingsAppearanceRiskLevelsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/appearance/risk-levels',
  component: () => (
    <RequirePermission perm="org:manage">
      <AppearanceRiskLevelsPage />
    </RequirePermission>
  ),
});

const settingsUsersRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/users',
  component: () => (
    <RequirePermission perm="users:manage">
      <UsersAdminPage />
    </RequirePermission>
  ),
});

const settingsRolesRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/roles',
  component: () => (
    <RequirePermission perm="org:manage">
      <RolesPage />
    </RequirePermission>
  ),
});

const settingsOrgRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/organization',
  component: () => (
    <RequirePermission perm="org:manage">
      <OrgGeneralPage />
    </RequirePermission>
  ),
});

const settingsAboutRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/about',
  component: () => (
    <RequirePermission perm="org:manage">
      <AboutPage />
    </RequirePermission>
  ),
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
    adminTemplatesRoute,
    surveysRoute,
    mySurveysRoute,
    surveyRunRoute,
    adminSurveyTemplatesRoute,
    adminSurveyConfigRoute,
    settingsLayoutRoute.addChildren([
      settingsIndexRoute,
      settingsAppearanceIndexRoute,
      settingsAppearanceAssetRolesRoute,
      settingsAppearanceAssetTypesRoute,
      settingsAppearanceEdgesRoute,
      settingsAppearanceRiskLevelsRoute,
      settingsUsersRoute,
      settingsRolesRoute,
      settingsOrgRoute,
      settingsAboutRoute,
    ]),
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
