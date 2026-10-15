import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Keeps the /read URL in sync with the canonical slug for what is on screen
 * (highlighted verses, else the active chapter).
 *
 * Canonicalizing is not navigation, so it REPLACES: a tile deeplink to a
 * non-canonical slug (e.g. /read/ether-6/8 -> /read/ether.6/8) must cost one
 * history entry, and Back must not land on the pre-canonical URL only to be
 * re-canonicalized forward again (audit R2.2 E1).
 */
export function useCanonicalReadSlug(idealSlug, urlSlug) {
    const navigate = useNavigate();
    const location = useLocation();
    const current = urlSlug ?? location.pathname.replace(/^\/read\//, "");
    useEffect(() => {
        if (idealSlug && idealSlug !== current) {
            navigate(`/read/${idealSlug}`, { replace: true });
        }
    }, [idealSlug, current, navigate]);
}

export default useCanonicalReadSlug;
