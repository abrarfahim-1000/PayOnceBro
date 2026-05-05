import { useCallback, useState } from "react"
import { toast } from 'sonner'

const isSuppressedRoleError = (message = '') =>
    message.trim().toLowerCase() === 'access denied: insufficient role'

const useFetch = (cb) => {
    const [data, setData] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const fn = useCallback(async (...args) => {
        setLoading(true)
        setError(null)
        try {
            const result = await cb(...args)
            setData(result)
        } catch (err) {
            // Prefer the backend's error message over the generic axios message
            const message =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Something went wrong'
            setError({ ...err, message })
            if (!isSuppressedRoleError(message)) {
                toast.error(message, { id: `error-${message}` })
            }
        } finally {
            setLoading(false)
        }
    }, [cb])
    return {
        data,
        error,
        loading,
        fn
    }
}

export default useFetch
