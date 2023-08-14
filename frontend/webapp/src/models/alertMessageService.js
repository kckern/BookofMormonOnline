import { toast } from 'react-toastify';

export function error(message) {
    toast.error(message, {
        position: "top-center"
    })
}

export function success(message) {
    toast.success(message, {
        position: "top-center"
    })
}

