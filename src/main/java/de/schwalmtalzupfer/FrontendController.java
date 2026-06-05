package de.schwalmtalzupfer;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class FrontendController {
    @RequestMapping(value = { "/kontakt", "/galerie", "/intern/**", "/admin/**" })
    public String forwardToFrontend() {
        return "forward:/index.html";
    }
}
