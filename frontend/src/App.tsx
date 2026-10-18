import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import AppLayout from "./components/AppLayout";
import RequireRole from "./components/RequireRole";
import RequireExactRole from "./components/RequireExactRole";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import QuestionBank from "./pages/QuestionBank";
import ExamBuilder from "./pages/ExamBuilder";
import ExamList from "./pages/ExamList";
import TestTaking from "./pages/TestTaking";
import Results from "./pages/Results";
import GradingQueue from "./pages/GradingQueue";
import UserManagement from "./pages/UserManagement";
import SchoolManagement from "./pages/SchoolManagement";
import ChangePassword from "./pages/ChangePassword";
import Billing from "./pages/Billing";
import Branding from "./pages/Branding";
import Curriculum from "./pages/Curriculum";
import AIQuestions from "./pages/AIQuestions";
import Activity from "./pages/Activity";
import PersonActivity from "./pages/PersonActivity";
import AttemptDetail from "./pages/AttemptDetail";


export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />

            <Route path="/:role" element={<RequireRole />}>
              <Route element={<AppLayout />}>
                <Route element={<RequireExactRole allow={["superadmin"]} />}>
                  <Route path="schools" element={<SchoolManagement />} />
                </Route>
                <Route element={<RequireExactRole allow={["admin"]} />}>
                  <Route path="setup" element={<Setup />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="billing" element={<Billing />} />
                  <Route path="branding" element={<Branding />} />
                  <Route path="activity" element={<Activity />} />
                  <Route path="activity/people/:userId" element={<PersonActivity />} />
                  <Route path="activity/attempts/:id" element={<AttemptDetail />} />
                </Route>
                <Route element={<RequireExactRole allow={["admin", "teacher"]} />}>
                  <Route path="questions" element={<QuestionBank />} />
                  <Route path="curriculum" element={<Curriculum />} />
                  <Route path="exams/new" element={<ExamBuilder />} />
                  <Route path="exams/:id/edit" element={<ExamBuilder />} />
                </Route>
                <Route element={<RequireExactRole allow={["teacher"]} />}>
                  <Route path="grading/:examId" element={<GradingQueue />} />
                  <Route path="ai-questions" element={<AIQuestions />} />
                </Route>
                <Route element={<RequireExactRole allow={["student"]} />}>
                  <Route path="exams/:id/take" element={<TestTaking />} />
                </Route>
                <Route path="exams" element={<ExamList />} />
                <Route path="results" element={<Results />} />
                <Route path="change-password" element={<ChangePassword />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  );
}