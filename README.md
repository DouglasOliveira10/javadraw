# JavaDraw

Análise estática de bytecode Java (ASM) que gera um **HTML interativo e autocontido** mostrando a estrutura
do código — um "UML moderno" — e o fluxo de chamadas a partir de qualquer método.

- **Estrutura**: classes, interfaces, enums e records agrupados por pacote, com herança, implementação,
  associações (campos, com multiplicidade) e dependências. Estereótipos detectados por anotação
  (`@RestController`, `@Service`, `@Repository`, `@Entity`, ...) colorem os cartões.
- **Fluxo de chamadas**: a partir de um entry point (endpoints HTTP, listeners, `@Scheduled`, `main`) ou de
  qualquer método, segue as chamadas (inclusive dentro de lambdas e method references) e as implementações
  de interfaces (class hierarchy analysis).
- Layout com [ELK](https://eclipse.dev/elk/) (elkjs em Web Worker) e renderização com
  [React Flow](https://reactflow.dev). Funciona offline, abrindo o arquivo direto no navegador.

## Uso

```bash
./mvnw verify                                  # gera javadraw-cli/target/javadraw.jar

java -jar javadraw-cli/target/javadraw.jar target/classes --open
java -jar javadraw-cli/target/javadraw.jar app.jar -i 'com.acme.**' -o docs/arquitetura.html
java -jar javadraw-cli/target/javadraw.jar target/classes -cp 'target/dependency/*' --json graph.json
```

| Opção | Descrição |
|---|---|
| `INPUT...` | Diretórios de `.class`, jars, wars ou fat jars Spring Boot |
| `-o, --out` | HTML gerado (padrão `javadraw.html`) |
| `-i, --include` | Glob dos tipos a desenhar (`com.acme.**`); os demais tipos do projeto viram externos |
| `-e, --exclude` | Glob dos tipos removidos (`**.dto.**`, `*Test`) |
| `-cp, --classpath` | Dependências usadas só para resolver a hierarquia (`dir/*` inclui todos os jars) |
| `--external-calls` | `NONE`, `LIBRARIES` (padrão, sem JDK) ou `ALL` |
| `--json` | Também grava o grafo bruto em JSON |
| `--open` | Abre o resultado no navegador |

### API Java

```java
ProjectModel model = JavaDraw.analyzer()
        .input(Path.of("target/classes"))
        .include("com.acme.**")
        .analyze();
new GraphJsonWriter(true).write(model, Path.of("graph.json"));
```

## Módulos

| Módulo | Conteúdo |
|---|---|
| `javadraw-core` | Leitura de fontes (`source`), parsing ASM (`asm`), hierarquia/call graph/relações (`graph`), estereótipos e entry points (`analysis`), JSON (`export`) |
| `javadraw-ui` | React + TypeScript + `@xyflow/react` + `elkjs`, empacotado pelo Vite num único `index.html` |
| `javadraw-cli` | CLI picocli que injeta o JSON no HTML; fat jar `javadraw.jar` |

## Desenvolvimento da UI

```bash
cd javadraw-ui
npm install
npm run dev      # usa public/sample-graph.json (gere um novo com --json)
npm test
```
