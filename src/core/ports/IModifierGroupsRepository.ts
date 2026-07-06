/**
 * IModifierGroupsRepository — contrato para conocer qué productos
 * tienen grupos de modificadores activos en una organización.
 *
 * Fase 2 · Hexagonal. Consumido por useProductsWithModifiers.
 */

export interface IModifierGroupsRepository {
  /** IDs de productos con al menos un modifier_group activo. */
  listProductIdsWithActiveGroups(organizationId: string): Promise<string[]>;

  /**
   * Suscribe cambios en `modifier_groups` filtrados por organización.
   * Devuelve una función de desuscripción.
   */
  subscribeGroupChanges(
    organizationId: string,
    onChange: () => void,
  ): () => void;
}
