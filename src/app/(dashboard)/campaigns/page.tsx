import { getCampaigns } from "@/app/campaigns/actions";
import { CampaignList } from "@/components/campaigns/campaign-list";
import "./campaigns.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Campaigns — ProspectIQ",
    description: "Manage your outreach campaigns and email sequences.",
};

export default async function CampaignsPage() {
    const { data: campaigns, error } = await getCampaigns();

    if (error && error !== "Not authenticated") {
        throw new Error(error);
    }

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Campaigns</h1>
                <p className="page-subtitle">
                    {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
                </p>
            </div>

            <CampaignList campaigns={campaigns} />
        </>
    );
}
