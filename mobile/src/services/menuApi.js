import { api } from './apiClient';

const PREFIX = '/api/v1/menu';

export const menuApi = {
  // Categories
  listCategories: () => api.get(`${PREFIX}/categories/`),
  getCategory: (id) => api.get(`${PREFIX}/categories/${id}/`),
  createCategory: (data) => api.post(`${PREFIX}/categories/`, data),
  updateCategory: (id, data) => api.put(`${PREFIX}/categories/${id}/`, data),
  deleteCategory: (id) => api.delete(`${PREFIX}/categories/${id}/`),

  // Menu Items
  listItems: (params = {}) => api.get(`${PREFIX}/items/`, params),
  getItem: (id) => api.get(`${PREFIX}/items/${id}/`),
  // Accepts a FormData (with optional image file) or a plain object
  createItem: (data) => {
    if (data instanceof FormData) {
      return api.upload(`${PREFIX}/items/`, data);
    }
    return api.post(`${PREFIX}/items/`, data);
  },
  updateItem: (id, data) => api.put(`${PREFIX}/items/${id}/`, data),
  deleteItem: (id) => api.delete(`${PREFIX}/items/${id}/`),

  // Ingredients
  listIngredients: () => api.get(`${PREFIX}/ingredients/`),
  getIngredient: (id) => api.get(`${PREFIX}/ingredients/${id}/`),
  createIngredient: (data) => api.post(`${PREFIX}/ingredients/`, data),
  updateIngredient: (id, data) => api.put(`${PREFIX}/ingredients/${id}/`, data),
  deleteIngredient: (id) => api.delete(`${PREFIX}/ingredients/${id}/`),

  // Stock
  adjustStock: (data) => api.post(`${PREFIX}/stock/adjust/`, data),
  listStockMovements: (params = {}) => api.get(`${PREFIX}/stock/movements/`, params),

  // Recipes
  listRecipes: (params = {}) => api.get(`${PREFIX}/recipes/`, params),
  createRecipe: (data) => api.post(`${PREFIX}/recipes/`, data),
  updateRecipe: (id, data) => api.put(`${PREFIX}/recipes/${id}/`, data),
  deleteRecipe: (id) => api.delete(`${PREFIX}/recipes/${id}/`),
};
