package br.com.douglasoliveira10.javadraw.cli;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HtmlRendererTest {

    @Test
    void replacesOnlyTheDataElement() {
        String template = "<script>const token=`__JAVADRAW_DATA__`</script><body>" + HtmlRenderer.PLACEHOLDER + "</body>";

        String html = HtmlRenderer.render(template, "{\"name\":\"shop\"}");

        assertThat(html).startsWith("<script>const token=`__JAVADRAW_DATA__`</script>");
        assertThat(html).contains("<script id=\"javadraw-data\" type=\"application/json\">{\"name\":\"shop\"}</script></body>");
    }

    @Test
    void escapesMarkupInsideJson() {
        String html = HtmlRenderer.render(HtmlRenderer.PLACEHOLDER, "{\"type\":\"List<Order>\",\"x\":\"</script><script>\"}");

        assertThat(html).doesNotContain("</script><script>");
        assertThat(html).contains("List\\u003cOrder>");
        assertThat(html).endsWith("</script>");
    }

    @Test
    void failsWithoutPlaceholder() {
        assertThatThrownBy(() -> HtmlRenderer.render("<html></html>", "{}"))
                .isInstanceOf(IllegalStateException.class);
    }
}
