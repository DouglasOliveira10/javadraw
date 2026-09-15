package br.com.douglasoliveira10.javadraw.cli;

import br.com.douglasoliveira10.javadraw.export.GraphJsonWriter;
import br.com.douglasoliveira10.javadraw.model.ProjectModel;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Produces the self-contained HTML page: the prebuilt UI with the project graph embedded in a
 * {@code <script type="application/json">} element.
 */
public final class HtmlRenderer {

    static final String TEMPLATE = "/META-INF/javadraw/index.html";
    /** The data element itself is matched, since the bundled JavaScript may contain the bare token too. */
    static final String PLACEHOLDER = "<script id=\"javadraw-data\" type=\"application/json\">__JAVADRAW_DATA__</script>";
    private static final String DATA_OPEN = "<script id=\"javadraw-data\" type=\"application/json\">";

    private final GraphJsonWriter json = new GraphJsonWriter();

    public String render(ProjectModel model) throws IOException {
        return render(template(), json.toJson(model));
    }

    public void write(ProjectModel model, Path file) throws IOException {
        Path parent = file.toAbsolutePath().getParent();
        if (parent != null) Files.createDirectories(parent);
        Files.writeString(file, render(model), StandardCharsets.UTF_8);
    }

    static String render(String template, String json) {
        int index = template.indexOf(PLACEHOLDER);
        if (index < 0) throw new IllegalStateException("UI template has no javadraw-data placeholder element");
        // "<" only occurs inside JSON strings, so escaping it keeps the JSON valid and the script element closed.
        String safeJson = json.replace("<", "\\u003c");
        return template.substring(0, index) + DATA_OPEN + safeJson + "</script>"
               + template.substring(index + PLACEHOLDER.length());
    }

    private static String template() throws IOException {
        try (InputStream in = HtmlRenderer.class.getResourceAsStream(TEMPLATE)) {
            if (in == null) {
                throw new IOException("UI template " + TEMPLATE + " not found on the classpath; build javadraw-ui first");
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
