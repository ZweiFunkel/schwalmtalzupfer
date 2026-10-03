package de.schwalmtalzupfer.page;

import org.springframework.security.core.Authentication;
import java.util.Set;

public final class PageVisibility {
    private PageVisibility() {}
    public static boolean hasRole(Authentication auth, String... roles) {
        if (auth == null || !auth.isAuthenticated()) return false;
        Set<String> allowed = Set.of(roles);
        return auth.getAuthorities().stream().anyMatch(a -> allowed.contains(a.getAuthority()));
    }
    public static boolean signedIn(Authentication auth) {
        return hasRole(auth, "ROLE_GUEST", "ROLE_MEMBER", "ROLE_BOARD", "ROLE_CHEF", "ROLE_ADMIN");
    }
    public static boolean canRead(Page page, Authentication auth) {
        boolean admin = hasRole(auth, "ROLE_ADMIN");
        if (!page.isPublished() && !admin) return false;
        String slug = page.getSlug();
        if (slug == null) return false;
        if (slug.equals("admin") || slug.startsWith("admin/")) return admin;
        if (slug.equals("noten") || slug.equals("intern/videos")) return hasRole(auth, "ROLE_GUEST", "ROLE_MEMBER", "ROLE_BOARD", "ROLE_ADMIN");
        if (slug.equals("intern") || slug.startsWith("intern/") || slug.equals("galerie-intern") || slug.startsWith("galerie-intern/")) return signedIn(auth);
        return true;
    }
}
