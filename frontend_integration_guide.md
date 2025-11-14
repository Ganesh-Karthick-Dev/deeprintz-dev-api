# Frontend Integration Guide for getAllTenants API

## 🚀 API Endpoint
```
GET /getAllTenants
```

## 📋 Available Query Parameters

| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `page` | number | 1 | Page number for pagination | `?page=2` |
| `limit` | number | 10 | Records per page (max: 100) | `?limit=20` |
| `search` | string | '' | Search term across multiple fields | `?search=company` |
| `status` | string | '' | Filter by user status | `?status=active` |
| `sortBy` | string | 'tenantname' | Sort field | `?sortBy=companyname` |
| `sortOrder` | string | 'asc' | Sort direction (asc/desc) | `?sortOrder=desc` |

## 🔍 Search Fields
The search parameter searches across these fields:
- Tenant Name
- Company Name
- Email
- Primary Contact
- Brand Name
- Country Name

## 📊 Response Structure

```json
{
  "status": true,
  "message": "Successfully retrieved tenants with pagination",
  "data": [
    {
      "userid": 123,
      "email": "tenant@example.com",
      "status": "active",
      "tenantname": "ABC Company",
      "companyname": "ABC Corp",
      "primarycontact": "John Doe",
      "tenantid": 456,
      "websiteurl": "https://abc.com",
      "address": "123 Main St",
      "state": "California",
      "city": "Los Angeles",
      "postcode": "90210",
      "countryid": 1,
      "handlingcharge": 5.00,
      "countryname": "United States",
      "brandname": "ABC Brand",
      "brandsticker": "sticker_url",
      "companylogo": "logo_url",
      "wallet": 1000.00
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalRecords": 50,
    "limit": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "filters": {
    "search": "company",
    "status": "active",
    "sortBy": "tenantname",
    "sortOrder": "asc"
  }
}
```

## 💻 Frontend Implementation Examples

### React.js Example

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TenantList = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    status: '',
    sortBy: 'tenantname',
    sortOrder: 'asc'
  });

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });

      const response = await axios.get(`/getAllTenants?${params}`);
      
      if (response.data.status) {
        setTenants(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [filters]);

  const handleSearch = (searchTerm) => {
    setFilters(prev => ({ ...prev, search: searchTerm, page: 1 }));
  };

  const handleStatusFilter = (status) => {
    setFilters(prev => ({ ...prev, status, page: 1 }));
  };

  const handleSort = (sortBy) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1
    }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  return (
    <div className="tenant-list">
      {/* Search and Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search tenants..."
          value={filters.search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        
        <select
          value={filters.status}
          onChange={(e) => handleStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split('-');
            setFilters(prev => ({ ...prev, sortBy, sortOrder, page: 1 }));
          }}
        >
          <option value="tenantname-asc">Name (A-Z)</option>
          <option value="tenantname-desc">Name (Z-A)</option>
          <option value="companyname-asc">Company (A-Z)</option>
          <option value="companyname-desc">Company (Z-A)</option>
          <option value="email-asc">Email (A-Z)</option>
          <option value="email-desc">Email (Z-A)</option>
        </select>
      </div>

      {/* Loading State */}
      {loading && <div>Loading...</div>}

      {/* Tenant Table */}
      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort('tenantname')}>
              Name {filters.sortBy === 'tenantname' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('companyname')}>
              Company {filters.sortBy === 'companyname' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('email')}>
              Email {filters.sortBy === 'email' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('status')}>
              Status {filters.sortBy === 'status' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map(tenant => (
            <tr key={tenant.tenantid}>
              <td>{tenant.tenantname}</td>
              <td>{tenant.companyname}</td>
              <td>{tenant.email}</td>
              <td>
                <span className={`status ${tenant.status}`}>
                  {tenant.status}
                </span>
              </td>
              <td>
                <button>View Details</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        <button
          disabled={!pagination.hasPrevPage}
          onClick={() => handlePageChange(pagination.currentPage - 1)}
        >
          Previous
        </button>
        
        <span>
          Page {pagination.currentPage} of {pagination.totalPages}
          ({pagination.totalRecords} total records)
        </span>
        
        <button
          disabled={!pagination.hasNextPage}
          onClick={() => handlePageChange(pagination.currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default TenantList;
```

### Vue.js Example

```vue
<template>
  <div class="tenant-list">
    <!-- Search and Filters -->
    <div class="filters">
      <input
        v-model="filters.search"
        @input="handleSearch"
        type="text"
        placeholder="Search tenants..."
      />
      
      <select v-model="filters.status" @change="handleStatusFilter">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      <select v-model="sortOption" @change="handleSortChange">
        <option value="tenantname-asc">Name (A-Z)</option>
        <option value="tenantname-desc">Name (Z-A)</option>
        <option value="companyname-asc">Company (A-Z)</option>
        <option value="companyname-desc">Company (Z-A)</option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="loading">Loading...</div>

    <!-- Tenant Table -->
    <table v-else>
      <thead>
        <tr>
          <th @click="handleSort('tenantname')">
            Name {{ getSortIcon('tenantname') }}
          </th>
          <th @click="handleSort('companyname')">
            Company {{ getSortIcon('companyname') }}
          </th>
          <th @click="handleSort('email')">
            Email {{ getSortIcon('email') }}
          </th>
          <th @click="handleSort('status')">
            Status {{ getSortIcon('status') }}
          </th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tenant in tenants" :key="tenant.tenantid">
          <td>{{ tenant.tenantname }}</td>
          <td>{{ tenant.companyname }}</td>
          <td>{{ tenant.email }}</td>
          <td>
            <span :class="`status ${tenant.status}`">
              {{ tenant.status }}
            </span>
          </td>
          <td>
            <button @click="viewDetails(tenant)">View Details</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div class="pagination">
      <button
        :disabled="!pagination.hasPrevPage"
        @click="handlePageChange(pagination.currentPage - 1)"
      >
        Previous
      </button>
      
      <span>
        Page {{ pagination.currentPage }} of {{ pagination.totalPages }}
        ({{ pagination.totalRecords }} total records)
      </span>
      
      <button
        :disabled="!pagination.hasNextPage"
        @click="handlePageChange(pagination.currentPage + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'TenantList',
  data() {
    return {
      tenants: [],
      loading: false,
      pagination: {},
      filters: {
        page: 1,
        limit: 10,
        search: '',
        status: '',
        sortBy: 'tenantname',
        sortOrder: 'asc'
      }
    };
  },
  computed: {
    sortOption: {
      get() {
        return `${this.filters.sortBy}-${this.filters.sortOrder}`;
      },
      set(value) {
        const [sortBy, sortOrder] = value.split('-');
        this.filters.sortBy = sortBy;
        this.filters.sortOrder = sortOrder;
      }
    }
  },
  mounted() {
    this.fetchTenants();
  },
  methods: {
    async fetchTenants() {
      this.loading = true;
      try {
        const params = new URLSearchParams();
        Object.keys(this.filters).forEach(key => {
          if (this.filters[key]) params.append(key, this.filters[key]);
        });

        const response = await axios.get(`/getAllTenants?${params}`);
        
        if (response.data.status) {
          this.tenants = response.data.data;
          this.pagination = response.data.pagination;
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
      } finally {
        this.loading = false;
      }
    },
    handleSearch() {
      this.filters.page = 1;
      this.fetchTenants();
    },
    handleStatusFilter() {
      this.filters.page = 1;
      this.fetchTenants();
    },
    handleSort(sortBy) {
      if (this.filters.sortBy === sortBy) {
        this.filters.sortOrder = this.filters.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        this.filters.sortBy = sortBy;
        this.filters.sortOrder = 'asc';
      }
      this.filters.page = 1;
      this.fetchTenants();
    },
    handleSortChange() {
      this.filters.page = 1;
      this.fetchTenants();
    },
    handlePageChange(page) {
      this.filters.page = page;
      this.fetchTenants();
    },
    getSortIcon(field) {
      if (this.filters.sortBy === field) {
        return this.filters.sortOrder === 'asc' ? '↑' : '↓';
      }
      return '';
    },
    viewDetails(tenant) {
      // Handle view details
      console.log('View details for:', tenant);
    }
  }
};
</script>
```

### Vanilla JavaScript Example

```javascript
class TenantManager {
  constructor() {
    this.filters = {
      page: 1,
      limit: 10,
      search: '',
      status: '',
      sortBy: 'tenantname',
      sortOrder: 'asc'
    };
    this.tenants = [];
    this.pagination = {};
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.fetchTenants();
  }

  setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.filters.page = 1;
        this.debounce(() => this.fetchTenants(), 300)();
      });
    }

    // Status filter
    const statusSelect = document.getElementById('status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.filters.page = 1;
        this.fetchTenants();
      });
    }

    // Sort options
    const sortSelect = document.getElementById('sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const [sortBy, sortOrder] = e.target.value.split('-');
        this.filters.sortBy = sortBy;
        this.filters.sortOrder = sortOrder;
        this.filters.page = 1;
        this.fetchTenants();
      });
    }

    // Pagination buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('page-btn')) {
        const page = parseInt(e.target.dataset.page);
        this.handlePageChange(page);
      }
    });
  }

  async fetchTenants() {
    this.showLoading();
    
    try {
      const params = new URLSearchParams();
      Object.keys(this.filters).forEach(key => {
        if (this.filters[key]) params.append(key, this.filters[key]);
      });

      const response = await fetch(`/getAllTenants?${params}`);
      const data = await response.json();
      
      if (data.status) {
        this.tenants = data.data;
        this.pagination = data.pagination;
        this.renderTenants();
        this.renderPagination();
      } else {
        this.showError(data.message);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      this.showError('Failed to fetch tenants');
    } finally {
      this.hideLoading();
    }
  }

  renderTenants() {
    const tbody = document.getElementById('tenant-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.tenants.map(tenant => `
      <tr>
        <td>${tenant.tenantname}</td>
        <td>${tenant.companyname}</td>
        <td>${tenant.email}</td>
        <td>
          <span class="status ${tenant.status}">${tenant.status}</span>
        </td>
        <td>
          <button onclick="viewTenantDetails(${tenant.tenantid})">View Details</button>
        </td>
      </tr>
    `).join('');
  }

  renderPagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    const { currentPage, totalPages, hasPrevPage, hasNextPage, totalRecords } = this.pagination;
    
    pagination.innerHTML = `
      <button 
        class="page-btn" 
        data-page="${currentPage - 1}"
        ${!hasPrevPage ? 'disabled' : ''}
      >
        Previous
      </button>
      
      <span>
        Page ${currentPage} of ${totalPages} (${totalRecords} total records)
      </span>
      
      <button 
        class="page-btn" 
        data-page="${currentPage + 1}"
        ${!hasNextPage ? 'disabled' : ''}
      >
        Next
      </button>
    `;
  }

  handlePageChange(page) {
    this.filters.page = page;
    this.fetchTenants();
  }

  showLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'block';
  }

  hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  }

  showError(message) {
    // Implement error display
    console.error(message);
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TenantManager();
});

// Global function for tenant details
function viewTenantDetails(tenantId) {
  // Implement tenant details view
  console.log('View details for tenant:', tenantId);
}
```

## 🎨 CSS Styling Examples

```css
.tenant-list {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.filters {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.filters input,
.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.filters input {
  flex: 1;
  min-width: 200px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

th, td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

th:hover {
  background: #e9ecef;
}

.status {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.status.active {
  background: #d4edda;
  color: #155724;
}

.status.inactive {
  background: #f8d7da;
  color: #721c24;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
  padding: 15px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #007bff;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}
```

## 🔧 Additional Features to Consider

1. **Export Functionality**: Add export to CSV/Excel
2. **Bulk Actions**: Select multiple tenants for bulk operations
3. **Advanced Filters**: Date range, country filter, etc.
4. **Real-time Updates**: WebSocket integration for live updates
5. **Caching**: Implement client-side caching for better performance
6. **Infinite Scroll**: Alternative to pagination for mobile-friendly UI

## 📱 Mobile Responsiveness

```css
@media (max-width: 768px) {
  .filters {
    flex-direction: column;
  }
  
  .filters input,
  .filters select {
    width: 100%;
  }
  
  table {
    font-size: 14px;
  }
  
  th, td {
    padding: 8px;
  }
  
  .pagination {
    flex-direction: column;
    gap: 10px;
  }
}
```

This guide provides everything needed to integrate the updated `getAllTenants` API with pagination and search functionality into your frontend application! 🚀
