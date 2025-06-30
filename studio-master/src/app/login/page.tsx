
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { Loader2, Palette, KeyRound } from 'lucide-react';
import { addUser } from '@/lib/data';
import { useAuth } from '@/context/auth-context';
import { FullPageLoader } from '@/components/common/full-page-loader';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const resetPasswordSchema = z.object({
  resetEmail: z.string().email({ message: 'Invalid email address' }),
});
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPasswordView, setIsResetPasswordView] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const resetPasswordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      resetEmail: '',
    },
  });

  useEffect(() => {
    if (!authLoading && authUser) {
      router.replace('/'); // Redirect to dashboard if already logged in
    }
  }, [authUser, authLoading, router]);


  const onLoginSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        if (userCredential.user) {
            await sendEmailVerification(userCredential.user);
        }

        const username = data.email.split('@')[0] || `user_${Date.now()}`;
        await addUser({
          id: userCredential.user.uid,
          username,
          email: data.email,
          role: 'StandardUser',
        });

        toast({
          title: 'Account Created',
          description: `Verification email sent to ${data.email}. Please verify your email. You can now try logging in.`,
        });
        setIsSignUp(false);
        loginForm.reset();
      } else {
        await signInWithEmailAndPassword(auth, data.email, data.password);
        toast({
          title: 'Login Successful',
          description: 'Welcome back!',
        });
        router.push('/');
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      let description = 'An unexpected error occurred.';
      if (error.code) {
        if (error.code === 'auth/invalid-credential') {
          description = 'Incorrect email or password. Please check your credentials and try again.';
        } else {
          description = error.code.replace('auth/', '').replace(/-/g, ' ') + '.';
        }
      } else if (error.message) {
        description = error.message;
      }
      
      toast({
        title: isSignUp ? 'Sign Up Failed' : 'Login Failed',
        description: description,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPasswordSubmit = async (data: ResetPasswordFormValues) => {
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, data.resetEmail);
      toast({
        title: 'Password Reset Email Sent',
        description: `If an account exists for ${data.resetEmail}, a password reset link has been sent. Please check your inbox (and spam folder).`,
      });
      setIsResetPasswordView(false); // Go back to login view
      resetPasswordForm.reset();
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast({
        title: 'Password Reset Failed',
        description: error.code ? (error.code.replace('auth/', '').replace(/-/g, ' ') + '.') : (error.message || 'Could not send reset email. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || (!authLoading && authUser)) {
    return <FullPageLoader />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          {isResetPasswordView ? (
            <KeyRound className="mx-auto h-12 w-12 text-primary mb-2" />
          ) : (
            <Palette className="mx-auto h-12 w-12 text-primary mb-2" />
          )}
          <CardTitle className="text-3xl font-bold">
            {isResetPasswordView ? 'Reset Password' : 'FlowForm'}
          </CardTitle>
          <CardDescription>
            {isResetPasswordView
              ? 'Enter your email to receive a password reset link.'
              : isSignUp
              ? 'Create a new account'
              : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isResetPasswordView ? (
            <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Email</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  placeholder="name@example.com"
                  {...resetPasswordForm.register('resetEmail')}
                  disabled={isLoading}
                />
                {resetPasswordForm.formState.errors.resetEmail && (
                  <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.resetEmail.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Email
              </Button>
            </form>
          ) : (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  {...loginForm.register('email')}
                  disabled={isLoading}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...loginForm.register('password')}
                  disabled={isLoading}
                />
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          {isResetPasswordView ? (
            <Button variant="link" onClick={() => setIsResetPasswordView(false)} disabled={isLoading}>
              Back to Login
            </Button>
          ) : (
            <>
              <Button variant="link" onClick={() => setIsSignUp(!isSignUp)} disabled={isLoading}>
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </Button>
              <Button variant="link" onClick={() => setIsResetPasswordView(true)} disabled={isLoading} className="text-sm">
                Forgot Password?
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

