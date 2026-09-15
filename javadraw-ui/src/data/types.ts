// Mirrors the JSON written by br.com.douglasoliveira10.javadraw.export.GraphJsonWriter.
// Empty collections, nulls and empty strings are omitted by the writer, hence the optional fields.

export type TypeKind = 'CLASS' | 'INTERFACE' | 'ENUM' | 'RECORD' | 'ANNOTATION'
export type Visibility = 'PUBLIC' | 'PROTECTED' | 'PACKAGE' | 'PRIVATE'
export type RelationKind = 'EXTENDS' | 'IMPLEMENTS' | 'ASSOCIATION' | 'DEPENDENCY'
export type CallKind = 'STATIC' | 'VIRTUAL' | 'INTERFACE' | 'SPECIAL' | 'DYNAMIC' | 'OVERRIDE'

export interface AnnotationInfo {
  type: string
  values?: Record<string, unknown>
}

export interface FieldInfo {
  name: string
  type: string
  visibility: Visibility
  isStatic: boolean
  isFinal: boolean
  annotations?: AnnotationInfo[]
}

export interface MethodInfo {
  id: string
  name: string
  descriptor: string
  signature: string
  visibility: Visibility
  isStatic: boolean
  isAbstract: boolean
  isConstructor: boolean
  accessor: boolean
  generated: boolean
  inherited: boolean
  entryPoint: boolean
  endpoint?: string
  annotations?: AnnotationInfo[]
  line?: number
}

export interface TypeInfo {
  id: string
  name: string
  packageName?: string
  kind: TypeKind
  visibility: Visibility
  modifiers?: string[]
  superType?: string
  interfaces?: string[]
  annotations?: AnnotationInfo[]
  stereotypes?: string[]
  fields?: FieldInfo[]
  methods?: MethodInfo[]
  outer?: string
  anonymous: boolean
  external: boolean
  sourceFile?: string
}

export interface Relation {
  source: string
  target: string
  kind: RelationKind
  label?: string
  multiplicity?: string
}

export interface CallEdge {
  source: string
  target: string
  kind: CallKind
  line?: number
  polymorphic: boolean
}

export interface Graph {
  meta: { name: string; generatedAt: string; version: string }
  types: TypeInfo[]
  relations?: Relation[]
  calls?: CallEdge[]
}
