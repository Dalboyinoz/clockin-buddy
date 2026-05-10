import { Link, useLocation } from "wouter";
import { Clock, History, MapPin, BarChart2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClerk, useUser } from "@clerk/react";

const navItems = [
  { href: "/", label: "Clock In", icon: Clock },
  { href: "/history", label: "History", icon: History },
  { href: "/summary", label: "Summary", icon: BarChart2 },
  { href: "/location", label: "Location", icon: MapPin },
];

export function Navigation() {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  return (
    <>
      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden safe-area-bottom">
        <ul className="flex items-center justify-around px-2 py-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location === href;
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-1 text-xs font-medium transition-colors rounded-xl",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-5 h-5 mb-1" strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop Sidebar Nav */}
      <nav className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-64 border-r border-border bg-card">
        <div className="p-6">
          <div className="flex items-center gap-3 text-primary font-semibold text-xl tracking-tight">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
            ClockIn Buddy
          </div>
        </div>
        <div className="px-4 flex-1">
          <ul className="space-y-1.5">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = location === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        {/* User account section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-2 px-1">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="avatar" className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Account"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.emailAddresses?.[0]?.emailAddress ?? ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
