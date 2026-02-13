import { Sidebar } from "@/components/layout/sidebar";
import "./dashboard.css";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="app-shell">
            <Sidebar />
            <main className="app-main">{children}</main>
        </div>
    );
}
