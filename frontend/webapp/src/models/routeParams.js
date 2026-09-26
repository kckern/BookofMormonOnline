import { useParams } from "react-router-dom";

/**
 * Route params with v5's names preserved on react-router 7.
 *
 * Several routes used v5 patterns v7 cannot express — multi-segment (`:x*`,
 * `:x+`) and regex (`:x(\d+)`) params — so models/Routes.js converted them to
 * splats:
 *
 *   /analysis/:value*    -> /analysis/*
 *   /theater/:slug*      -> /theater/*
 *   /audit/:key*         -> /audit/*
 *   /welcome/:welcomeId+ -> /welcome/*
 *   /fax/:faxVersion+    -> /fax/*
 *   /timeline/:markerSlug (path array) -> /timeline/*
 *
 * The components on those routes still read the original name. Rather than
 * rewrite each one, this aliases the splat to them. A route has at most one
 * splat, and each of these names belongs to exactly one route, so the aliases
 * cannot collide — and a route with a real named param keeps it, because the
 * spread puts the actual params first and `??` only fills in what is absent.
 *
 * Routes whose splat needs real parsing rather than aliasing do NOT use this:
 * see models/pagePath.js (page/textblock/fax) and models/mapPath.js (Map).
 */
export function useLegacyParams() {
  const params = useParams();
  const splat = params["*"];
  if (splat == null) return params;
  return {
    ...params,
    value: params.value ?? splat,
    slug: params.slug ?? splat,
    key: params.key ?? splat,
    welcomeId: params.welcomeId ?? splat,
    faxVersion: params.faxVersion ?? splat,
    markerSlug: params.markerSlug ?? splat,
  };
}

export default useLegacyParams;
