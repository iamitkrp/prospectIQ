import { getProspects } from "@/app/prospects/actions";
import { ProspectTable } from "@/components/prospects/prospect-table";
import "./prospects.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Prospects — ProspectIQ",
    description: "Manage your outreach prospects.",
};

interface ProspectsPageProps {
    searchParams: Promise<{ page?: string }>;
}

export default async function ProspectsPage({ searchParams }: ProspectsPageProps) {
    const params = await searchParams;
    const page = Math.max(1, parseInt(params.page ?? "1", 10));
    const perPage = 15;

    const { data: prospects, count, error } = await getProspects(page, perPage);

    if (error && error !== "Not authenticated") {
        throw new Error(error);
    }

    const totalPages = Math.ceil((count ?? 0) / perPage);

    return (
        <>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 className="page-title">Prospects</h1>
                    <p className="page-subtitle">{count} contact{count !== 1 ? "s" : ""} in your database</p>
                </div>
            </div>

            <ProspectTable
                prospects={prospects}
                currentPage={page}
                totalPages={totalPages}
                totalCount={count ?? 0}
            />
        </>
    );
}
