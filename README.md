# JavaDraw

Análise estática de bytecode Java (ASM) que gera um **HTML interativo e autocontido** onde você **monta o
diagrama peça por peça** — como o draw.io, só que os componentes são as classes do seu projeto e as
ligações possíveis são exatamente as que existem no código.

1. Abra o HTML e escolha a **classe inicial** (árvore de pacotes estilo IDE, busca ou lista de entry points).
2. Selecione um card: o painel da direita mostra hierarquia, campos, métodos, *Uses* e *Used by*.
3. Clique em **+** para trazer o vizinho — o card e a seta aparecem juntos. Chamadas de método viram setas
   que saem da linha do método e chegam na linha do método chamado.
4. O **olho** mostra ou esconde cada campo/método no card.
5. Um card só pode ser removido quando tem **no máximo uma** relação no diagrama.

Posições são suas: arraste à vontade, com **Auto-arrange** ([ELK](https://eclipse.dev/elk/)) quando quiser
organizar tudo. O diagrama é salvo automaticamente no navegador e pode ser exportado/importado em JSON, ou
exportado em PNG. Renderização com [React Flow](https://reactflow.dev); tudo funciona offline.

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
| `-i, --include` | Glob dos tipos a analisar (`com.acme.**`); os demais tipos do projeto viram externos |
| `-e, --exclude` | Glob dos tipos removidos (`**.dto.**`, `*Test`) |
| `-cp, --classpath` | Dependências usadas só para resolver a hierarquia (`dir/*` inclui todos os jars) |
| `--external-calls` | `NONE`, `LIBRARIES` (padrão, sem JDK) ou `ALL` |
| `--json` | Também grava o grafo bruto em JSON |
| `--open` | Abre o resultado no navegador |

O que a análise extrai: tipos (classe, interface, enum, record), campos e métodos, herança, implementação,
associações (com multiplicidade), dependências, grafo de chamadas (lambdas e method references incluídos,
implementações de interface resolvidas por class hierarchy analysis), estereótipos por anotação
(`@RestController`, `@Service`, `@Repository`, `@Entity`, ...) e entry points (`GET /orders/{id}`,
`@KafkaListener`, `main`).

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
| `javadraw-ui` | React + TypeScript + `@xyflow/react` + `elkjs`; o canvas e suas regras ficam em `src/diagram` (estado em `canvasState.ts`) |
| `javadraw-cli` | CLI picocli que injeta o JSON no HTML; fat jar `javadraw.jar` |

## Desenvolvimento da UI

```bash
cd javadraw-ui
npm install
npm run dev      # usa public/sample-graph.json (gere um novo com --json)
npm test
```
