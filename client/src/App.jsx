import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Protected } from './components/Guards';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/Auth';
import Expos from './pages/Expos';
import ExpoDetail from './pages/ExpoDetail';
import { Exhibitors, ExhibitorDetail } from './pages/Exhibitors';
import Messages from './pages/Messages';
import { Notifications, FeedbackPage, Account, MySchedule, NotFound } from './pages/Misc';
import Dashboard from './pages/admin/Dashboard';
import AdminExpos from './pages/admin/Expos';
import ExpoManage from './pages/admin/ExpoManage';
import Applications from './pages/admin/Applications';
import Reports from './pages/admin/Reports';
import FeedbackAdmin from './pages/admin/FeedbackAdmin';
import ExhibitorProfile from './pages/exhibitor/Profile';
import ExhibitorApplications from './pages/exhibitor/Applications';
import MyBooth from './pages/exhibitor/MyBooth';

const admin = (el) => <Protected roles={['admin']}>{el}</Protected>;
const exhibitor = (el) => <Protected roles={['exhibitor']}>{el}</Protected>;
const anyUser = (el) => <Protected>{el}</Protected>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Expos />} />
        <Route path="/expos/:id" element={<ExpoDetail />} />
        <Route path="/exhibitors" element={<Exhibitors />} />
        <Route path="/exhibitors/:userId" element={<ExhibitorDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        <Route path="/messages" element={anyUser(<Messages />)} />
        <Route path="/notifications" element={anyUser(<Notifications />)} />
        <Route path="/feedback" element={anyUser(<FeedbackPage />)} />
        <Route path="/account" element={anyUser(<Account />)} />
        <Route path="/my-schedule" element={anyUser(<MySchedule />)} />

        <Route path="/admin" element={admin(<Dashboard />)} />
        <Route path="/admin/expos" element={admin(<AdminExpos />)} />
        <Route path="/admin/expos/:id" element={admin(<ExpoManage />)} />
        <Route path="/admin/applications" element={admin(<Applications />)} />
        <Route path="/admin/reports" element={admin(<Reports />)} />
        <Route path="/admin/feedback" element={admin(<FeedbackAdmin />)} />

        <Route path="/exhibitor" element={<Navigate to="/exhibitor/profile" replace />} />
        <Route path="/exhibitor/profile" element={exhibitor(<ExhibitorProfile />)} />
        <Route path="/exhibitor/applications" element={exhibitor(<ExhibitorApplications />)} />
        <Route path="/exhibitor/booth" element={exhibitor(<MyBooth />)} />
        <Route path="/exhibitor/booth/:expoId" element={exhibitor(<MyBooth />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
