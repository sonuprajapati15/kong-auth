import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login/Login.jsx";
import Signup from "./pages/Signup/Signup.jsx";
import HomeLayout from "./pages/Home/HomeLayout.jsx";
import ProtectedRoute from "./config/ProtectedRoute.jsx";
import Dashboard from "./pages/Home/tabs/page/Dashboard.jsx";
import Fields from "./pages/Home/tabs/page/Fields.jsx";
import Webhooks from "./pages/Home/tabs/page/Webhooks.jsx";
import Actions from "./pages/Home/tabs/page/Actions.jsx";
import Groups from "./pages/Home/tabs/page/Groups.jsx";
import GroupDetails from "./pages/Home/tabs/page/GroupDetails.jsx";
import Rules from "./pages/Home/tabs/page/Rules.jsx";
import Analytics from "./pages/Home/tabs/page/Analytics.jsx";
import UserChipLayout from "./pages/Home/tabs/page/UserChipLayout.jsx";
import RuleBuilder from "./pages/Home/tabs/page/RuleBuilder.jsx"
import EmailServerConfig from "./pages/Home/tabs/page/EmailServerConfig.jsx";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route
                path="/home"
                element={
                    <ProtectedRoute>
                        <HomeLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="analytics" element={<Analytics />} />

                <Route path="fields" element={<Fields />} />
                <Route path="actions" element={<Actions />} />

                <Route path="webhooks" element={<Webhooks />} />
                <Route path="email-server" element={<EmailServerConfig />} />

                <Route path="groups" element={<Groups />} />
                <Route path="groupDetails/:id" element={<GroupDetails />} />

                <Route path="rules" element={<Rules />} />
                <Route path="rules/new" element={<RuleBuilder mode="create" />} />
                <Route path="rules/:id" element={<RuleBuilder mode="edit" />} />

                <Route path="userchiplayout" element={<UserChipLayout />} />

            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}