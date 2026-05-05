import React, { useEffect, useState } from 'react'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "../../components/ui/card"
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { BeatLoader } from 'react-spinners'
import Error from '../../components/common/Error'
import * as Yup from 'yup'
import useFetch from '../../hooks/useFetch'
import { login } from '../../services/authService'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

const Login = () => {
    const [errors, setErrors] = useState({})
    const [formdata, setformdata] = useState({
        email: "",
        password: ""
    })

    const navigate = useNavigate()
    let [searchParams] = useSearchParams()
    const longlink = searchParams.get("createNew")

    const { data, error, loading, fn: fnlogin } = useFetch(login, formdata)

    useEffect(() => {
        const finalizeLogin = async () => {
            if (!(data && !error)) return

            toast.success('Signed in. Welcome back.')
            navigate(`/auth${longlink ? `?createNew=${longlink}` : ''}`, { replace: true })
        }

        finalizeLogin()
    }, [data, error, navigate, longlink])

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setformdata((prevState) => ({
            ...prevState,
            [name]: value,
        }))
    }

    const handleLogin = async () => {
        setErrors({})
        try {
            const schema = Yup.object().shape({
                email: Yup.string().email("Invalid email").required("Email is required"),
                password: Yup.string().min(6, "Password must be at least 6 characters").required("Password is required")
            })
            await schema.validate(formdata, { abortEarly: false })
            await fnlogin(formdata)
        }
        catch (e) {
            const newerrors = {}
            e?.inner?.forEach(element => {
                newerrors[element.path] = element.message
            })
            setErrors(newerrors)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>Login to your account if available</CardDescription>
                {error && <Error message={error.message} />}
            </CardHeader>
            <form
                onSubmit={async (e) => {
                    e.preventDefault()
                    await handleLogin()
                }}
            >
                <CardContent className="space-y-2">
                    <div className="space-y-1">
                        <Input name="email" type="email" placeholder="Enter Email" onChange={handleInputChange} value={formdata.email} />
                        {errors.email && <Error message={errors.email} />}
                    </div>
                    <div className="space-y-1">
                        <Input name="password" type="password" placeholder="Enter Password" onChange={handleInputChange} value={formdata.password} />
                        {errors.password && <Error message={errors.password} />}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit">{loading ? <BeatLoader size={10} color="white" /> : "Login"}</Button>
                </CardFooter>
            </form>
        </Card>
    )
}

export default Login
