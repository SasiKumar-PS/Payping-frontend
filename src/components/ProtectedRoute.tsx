import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
    const token = localStorage.getItem('token');

    // If no token exists, redirect to Welcome page
    if (!token) {
        return <Navigate to="/" replace />;
    }

    // If token exists, "Outlet" renders the child component (the Profile page)
    return <Outlet />;
};

export default ProtectedRoute;