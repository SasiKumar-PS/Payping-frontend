import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1/',
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
        if(response.status > 299){
            showError(response.data, response.status);
        }
        return response;
    },
    (error) => {
        showError(error.response?.data?.error, error.response?.data?.status);
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