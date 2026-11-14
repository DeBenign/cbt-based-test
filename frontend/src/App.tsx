import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import AppLayout from "./components/AppLayout";
import RequireRole from "./components/RequireRole";
import RequireExactRole from "./components/RequireExactRole";
import Home from "./pages/Home";
import Login from "./pages/Login";
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Setup = lazy(() => import("./pages/Setup"));
const QuestionBank = lazy(() => import("./pages/QuestionBank"));
const ExamBuilder = lazy(() => import("./pages/ExamBuilder"));
const ExamList = lazy(() => import("./pages/ExamList"));
const TestTaking = lazy(() => import("./pages/TestTaking"));
const Results = lazy(() => import("./pages/Results"));
const GradingQueue = lazy(() => import("./pages/GradingQueue"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const SchoolManagement = lazy(() => import("./pages/SchoolManagement"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Billing = lazy(() => import("./pages/Billing"));
const Receipt = lazy(() => import("./pages/Receipt"));
const Branding = lazy(() => import("./pages/Branding"));
const Curriculum = lazy(() => import("./pages/Curriculum"));
const AIQuestions = lazy(() => import("./pages/AIQuestions"));
const AIHistory = lazy(() => import("./pages/AIHistory"));
const AIReports = lazy(() => import("./pages/AIReports"));
const Analytics = lazy(() => import("./pages/Analytics"));
const MyProgress = lazy(() => import("./pages/MyProgress"));
const SchoolOverview = lazy(() => import("./pages/SchoolOverview"));
const Remarks = lazy(() => import("./pages/Remarks"));
const StaffIndicators = lazy(() => import("./pages/StaffIndicators"));
const ReportCards = lazy(() => import("./pages/ReportCards"));
const MyReportCard = lazy(() => import("./pages/MyReportCard"));
const Activity = lazy(() => import("./pages/Activity"));
const PersonActivity = lazy(() => import("./pages/PersonActivity"));
const AttemptDetail = lazy(() => import("./pages/AttemptDetail"));


export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Suspense fallback={<p style={{ padding: 24, color: "var(--text-secondary)" }}>Loading…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/:role" element={<RequireRole />}>
              <Route element={<AppLayout />}>
                <Route element={<RequireExactRole allow={["superadmin"]} />}>
                  <Route path="schools" element={<SchoolManagement />} />
                  <Route path="ai-reports" element={<AIReports />} />
                </Route>
                <Route element={<RequireExactRole allow={["admin", "superadmin"]} />}>
                  <Route path="receipt/:paymentId" element={<Receipt />} />
                </Route>
                <Route element={<RequireExactRole allow={["admin"]} />}>
                  <Route path="setup" element={<Setup />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="overview" element={<SchoolOverview />} />
                  <Route path="report-cards" element={<ReportCards />} />
                  <Route path="billing" element={<Billing />} />
                  <Route path="branding" element={<Branding />} />
                  <Route path="activity" element={<Activity />} />
                  <Route path="activity/people/:userId" element={<PersonActivity />} />
                  <Route path="activity/attempts/:id" element={<AttemptDetail />} />
                </Route>
                <Route element={<RequireExactRole allow={["admin", "teacher"]} />}>
                  <Route path="questions" element={<QuestionBank />} />
                  <Route path="curriculum" element={<Curriculum />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="remarks" element={<Remarks />} />
                  <Route path="staff" element={<StaffIndicators />} />
                </Route>
                <Route element={<RequireExactRole allow={["teacher"]} />}>
                  <Route path="exams/new" element={<ExamBuilder />} />
                  <Route path="exams/:id/edit" element={<ExamBuilder />} />
                  <Route path="grading/:examId" element={<GradingQueue />} />
                  <Route path="ai-questions" element={<AIQuestions />} />
                  <Route path="ai-history" element={<AIHistory />} />
                </Route>
                <Route element={<RequireExactRole allow={["student"]} />}>
                  <Route path="exams/:id/take" element={<TestTaking />} />
                  <Route path="progress" element={<MyProgress />} />
                  <Route path="report-card" element={<MyReportCard />} />
                </Route>
                <Route path="exams" element={<ExamList />} />
                <Route path="results" element={<Results />} />
                <Route path="change-password" element={<ChangePassword />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  );
}