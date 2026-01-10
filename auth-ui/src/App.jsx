import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login/Login.jsx";
import Signup from "./pages/Signup/Signup.jsx";
import HomeLayout from "./pages/Home/HomeLayout.jsx";
import ProtectedRoute from "./config/ProtectedRoute.jsx";
import Dashboard from "./pages/Home/tabs/page/Dashboard.jsx";
import Fields from "./pages/Home/tabs/page/Fields.jsx";
import Payments from "./pages/Home/tabs/page/Payments.jsx";
import Actions from "./pages/Home/tabs/page/Actions.jsx";
import Groups from "./pages/Home/tabs/page/Groups.jsx";
import Analytics from "./pages/Home/tabs/page/Analytics.jsx";
import UserChipLayout from "./pages/Home/tabs/page/UserChipLayout.jsx";

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
                <Route path="payments" element={<Payments />} />
                <Route path="actions" element={<Actions />} />
                <Route path="groups" element={<Groups />} />
                <Route path="userchiplayout" element={<UserChipLayout />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}