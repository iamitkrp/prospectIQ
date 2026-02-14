export default function ProspectsLoading() {
    return (
        <div className="loading-container">
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <div className="skeleton skeleton-title" />
                    <div className="skeleton skeleton-subtitle" />
                </div>
                <div className="skeleton" style={{ height: "40px", width: "140px", borderRadius: "10px" }} />
            </div>
            <div style={{ marginTop: "1.5rem" }}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <div
                        key={i}
                        className="skeleton"
                        style={{ height: "52px", width: "100%", marginBottom: "0.5rem", borderRadius: "8px" }}
                    />
                ))}
            </div>
        </div>
    );
}
