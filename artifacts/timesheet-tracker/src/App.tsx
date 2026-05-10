import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Capacitor } from "@capacitor/core";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";
import Home from "@/pages/home";
import History from "@/pages/history";
import LocationSettings from "@/pages/location";
import Summary from "@/pages/summary";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(185 62% 23%)",
    colorForeground: "hsl(215 25% 15%)",
    colorMutedForeground: "hsl(215 15% 45%)",
    colorDanger: "hsl(0 70% 45%)",
    colorBackground: "hsl(40 20% 97%)",
    colorInput: "hsl(215 15% 90%)",
    colorInputForeground: "hsl(215 25% 15%)",
    colorNeutral: "hsl(215 15% 90%)",
    fontFamily: "var(--font-sans)",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[hsl(215_25%_15%)] font-semibold",
    headerSubtitle: "text-[hsl(215_15%_45%)]",
    socialButtonsBlockButtonText: "text-[hsl(215_25%_15%)]",
    formFieldLabel: "text-[hsl(215_25%_15%)]",
    footerActionLink: "text-[hsl(185_62%_23%)]",
    footerActionText: "text-[hsl(215_15%_45%)]",
    dividerText: "text-[hsl(215_15%_45%)]",
    identityPreviewEditButton: "text-[hsl(185_62%_23%)]",
    formFieldSuccessText: "text-[hsl(185_62%_23%)]",
    alertText: "text-[hsl(215_25%_15%)]",
    logoBox: "flex justify-center mb-2",
    logoImage: "w-12 h-12",
    socialButtonsBlockButton: "border border-[hsl(215_15%_90%)] bg-white hover:bg-[hsl(215_20%_95%)]",
    formButtonPrimary: "bg-[hsl(185_62%_23%)] hover:bg-[hsl(185_62%_18%)]",
    formFieldInput: "border-[hsl(215_15%_90%)] bg-white",
    footerAction: "border-t border-[hsl(215_15%_90%)]",
    dividerLine: "bg-[hsl(215_15%_90%)]",
    alert: "border border-[hsl(215_15%_90%)]",
    otpCodeFieldInput: "border-[hsl(215_15%_90%)]",
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// In Capacitor WebView, session cookies aren't sent with fetch requests.
// This bridge grabs Clerk's JWT and attaches it as a Bearer token on every API call.
function CapacitorAuthBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
    return () => {
      if (Capacitor.isNativePlatform()) setAuthTokenGetter(null);
    };
  }, [getToken, isSignedIn]);

  return null;
}

function AppRoutes() {
  return (
    <div className="flex flex-col min-h-[100dvh] pb-16 md:pb-0 md:pl-64">
      <CapacitorAuthBridge />
      <Navigation />
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/history" component={History} />
          <Route path="/location" component={LocationSettings} />
          <Route path="/summary" component={Summary} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route>
        <Show when="signed-in">
          <AppRoutes />
        </Show>
        <Show when="signed-out">
          <Redirect to="/sign-in" />
        </Show>
      </Route>
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to ClockIn Buddy",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start tracking your work hours",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
