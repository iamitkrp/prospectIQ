import { getProspects } from "@/app/prospects/actions";
import { ProspectTable } from "@/components/prospects/prospect-table";
import { ProspectsHeader } from "@/components/prospects/prospects-header";
import { SearchBar } from "@/components/prospects/search-bar";
import "./prospects.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Prospects — ProspectIQ",
    description: "Manage your outreach prospects.",
};

interface ProspectsPageProps {
    searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function ProspectsPage({ searchParams }: ProspectsPageProps) {
    const params = await searchParams;
    const page = Math.max(1, parseInt(params.page ?? "1", 10));
    const perPage = 15;
    const query = params.q?.trim() || undefined;

    const { data: prospects, count, error } = await getProspects(page, perPage, query);

    if (error && error !== "Not authenticated") {
        throw new Error(error);
    }

    const totalPages = Math.ceil((count ?? 0) / perPage);

    return (
        <>
            <ProspectsHeader count={count ?? 0} />

            <SearchBar resultCount={count ?? 0} />

            <ProspectTable
                prospects={prospects}
                currentPage={page}
                totalPages={totalPages}
                totalCount={count ?? 0}
                searchQuery={query}
            />
        </>
    );
}
