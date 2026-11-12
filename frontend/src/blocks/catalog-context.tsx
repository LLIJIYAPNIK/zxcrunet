"use client";

import { createContext, useContext, type ReactNode } from "react";

import { CatalogIndex, EMPTY_CATALOG, type Catalog } from "@/lib/catalog/catalog";

const CatalogContext = createContext<CatalogIndex>(new CatalogIndex(EMPTY_CATALOG));

/** The signed-in owner's catalog, for title pickers in block editors. */
export function CatalogProvider({ catalog, children }: { catalog: Catalog; children: ReactNode }) {
  return <CatalogContext value={new CatalogIndex(catalog)}>{children}</CatalogContext>;
}

export function useCatalog(): CatalogIndex {
  return useContext(CatalogContext);
}
