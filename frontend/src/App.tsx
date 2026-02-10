import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import ProjectTasks from './pages/admin/ProjectTasks';
import Workflow from './pages/admin/Workflow';
import CreateProject from './pages/admin/CreateProject';
import ProjectDetailsAdmin from './pages/admin/ProjectDetailsAdmin';
import Users from './pages/admin/Users';
import MyTasks from './pages/MyTasks';
import UserDashboard from './pages/UserDashboard';
import UserProjects from './pages/UserProjects';
import ProjectDetails from './pages/ProjectDetails';
import UserWorkflow from './pages/UserWorkflow';
import UserProfile from './pages/UserProfile';
import UserFolders from './pages/UserFolders';
import Activities from './pages/Activities';
import Settings from './pages/Settings';
import Login from './pages/Login';
import GoogleCallback from './pages/GoogleCallback';
import KanbanPage from './pages/KanbanPage';
import { AuthProvider } from './context/AuthContext';
import { DialogProvider } from './components/ui/Dialog';
import { PushNotificationProvider } from './context/PushNotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationNavigator from './components/NotificationNavigator';
import UpdateChecker from './components/UpdateChecker';

function App() {
  return (
    <HelmetProvider>
    <ThemeProvider>
      <AuthProvider>
        <DialogProvider>
          <PushNotificationProvider>
            <UpdateChecker />
            <BrowserRouter>
              <NotificationNavigator />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/google-callback" element={<GoogleCallback />} />

                {/* Admin Routes */}
                <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="projects" element={<ProjectTasks />} />
                    <Route path="projects/:id" element={<ProjectDetailsAdmin />} />
                    <Route path="users" element={<Users />} />
                    <Route path="folders" element={<UserFolders />} />
                    <Route path="workflow" element={<Workflow />} />
                    <Route path="create-project" element={<CreateProject />} />
                    <Route path="kanban" element={<KanbanPage />} />
                    <Route path="my-tasks" element={<MyTasks />} />
                    <Route path="profile" element={<UserProfile />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Route>

                {/* User Routes */}
                <Route element={<ProtectedRoute allowedRoles={['USER', 'ADMIN']} />}>
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<UserDashboard />} />
                    <Route path="projects" element={<UserProjects />} />
                    <Route path="projects/:id" element={<ProjectDetails />} />
                    <Route path="create-project" element={<CreateProject />} />
                    <Route path="kanban" element={<KanbanPage />} />
                    <Route path="my-tasks" element={<MyTasks />} />
                    <Route path="folders" element={<UserFolders />} />
                    <Route path="workflow" element={<UserWorkflow />} />
                    <Route path="activities" element={<Activities />} />
                    <Route path="profile" element={<UserProfile />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </PushNotificationProvider>
        </DialogProvider>
      </AuthProvider>
    </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;

