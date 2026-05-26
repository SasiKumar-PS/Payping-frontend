import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1/',
    // baseURL: 'http://10.11.111.244:8080/api/v1/',
});

// The "Interceptor": Runs before every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // to hide the error popup
    window.dispatchEvent(new CustomEvent('PAYPING_CLEAR_ERROR'));

    return config;
});

// ========================================================
// THE AXIOS INTERCEPTOR (CENTRALIZED ERROR PROCESSING)
// ========================================================
api.interceptors.response.use(
    (response) => {
        if (response.status > 299) {
            showError(response.data, response.status);
        } else if (['post', 'put', 'delete'].includes(response.config.method || '')) {
            const triggerSuccess = response.config.headers && (
                response.config.headers['X-Trigger-Success'] || 
                response.config.headers['x-trigger-success']
            );
            if (triggerSuccess) {
                // Extract a clean success message from the response data if present
                const successMsg = response.data?.message || "Operation completed successfully!";
                window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                    detail: successMsg
                }));
            }
        }
        return response;
    },
    (error) => {
        showError(error.response?.data?.error || error.response?.data?.message || "Unknown error occurred.", error.response?.data?.status);
        return Promise.reject(error);
    }
);

function showError(errorMessage, status) {
    if (status === 401) {
        localStorage.removeItem('token');
        sessionStorage.clear();
        // Broadcast a session expiry event
        window.dispatchEvent(new CustomEvent('SESSION_EXPIRED'));
    }

    // Broadcast the error message globally so any active page can catch it
    window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_ERROR', {
        detail: errorMessage
    }));
}

export default api;