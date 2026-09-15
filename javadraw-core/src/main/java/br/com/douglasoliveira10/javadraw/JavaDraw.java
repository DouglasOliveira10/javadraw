package br.com.douglasoliveira10.javadraw;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

/** Entry point of the library API. */
public final class JavaDraw {

    private JavaDraw() {
    }

    public static Analyzer analyzer() {
        return new Analyzer();
    }

    public static String version() {
        try (InputStream in = JavaDraw.class.getResourceAsStream("/META-INF/javadraw/javadraw.properties")) {
            if (in == null) return "dev";
            Properties properties = new Properties();
            properties.load(in);
            return properties.getProperty("version", "dev");
        } catch (IOException e) {
            return "dev";
        }
    }
}
