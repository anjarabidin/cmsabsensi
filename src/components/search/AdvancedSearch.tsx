import { useState, useEffect, useCallback } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { MultiSelectFilter } from '@/components/filters/MultiSelectFilter';
import { DateRange } from 'react-day-picker';

interface AdvancedSearchProps {
  onSearch: (query: string, filters: any) => void;
  placeholder?: string;
  showFilters?: boolean;
}

interface SearchFilters {
  dateRange?: DateRange;
  departments?: string[];
  statuses?: string[];
  roles?: string[];
}

export function AdvancedSearch({ 
  onSearch, 
  placeholder = "Cari...",
  showFilters = true 
}: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Department options
  const departmentOptions = [
    { label: 'IT', value: 'it' },
    { label: 'HR', value: 'hr' },
    { label: 'Finance', value: 'finance' },
    { label: 'Marketing', value: 'marketing' },
    { label: 'Operations', value: 'operations' },
  ];

  // Status options
  const statusOptions = [
    { label: 'Present', value: 'present' },
    { label: 'Late', value: 'late' },
    { label: 'Absent', value: 'absent' },
    { label: 'Leave', value: 'leave' },
    { label: 'Sick', value: 'sick' },
  ];

  // Role options
  const roleOptions = [
    { label: 'Admin HR', value: 'admin_hr' },
    { label: 'Manager', value: 'manager' },
    { label: 'Employee', value: 'employee' },
  ];

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Trigger search when debounced query or filters change
  useEffect(() => {
    onSearch(debouncedQuery, filters);
  }, [debouncedQuery, filters, onSearch]);

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setFilters({});
  }, []);

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const hasActiveFilters = Object.values(filters).some(value => 
    value && (Array.isArray(value) ? value.length > 0 : true)
  );

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.dateRange?.from) count++;
    if (filters.departments?.length) count++;
    if (filters.statuses?.length) count++;
    if (filters.roles?.length) count++;
    return count;
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        {/* Main Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {(query || hasActiveFilters) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {showFilters && (
            <Button
              variant="outline"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filter
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1">
                  {getActiveFiltersCount()}
                </Badge>
              )}
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && showFilters && (
          <div className="mt-4 space-y-4 border-t pt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Date Range Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Rentang Tanggal
                </label>
                <DateRangeFilter
                  value={filters.dateRange}
                  onChange={(range) => handleFilterChange('dateRange', range)}
                />
              </div>

              {/* Department Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Department
                </label>
                <MultiSelectFilter
                  options={departmentOptions}
                  value={filters.departments || []}
                  onChange={(values) => handleFilterChange('departments', values)}
                  placeholder="Pilih department"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Status
                </label>
                <MultiSelectFilter
                  options={statusOptions}
                  value={filters.statuses || []}
                  onChange={(values) => handleFilterChange('statuses', values)}
                  placeholder="Pilih status"
                />
              </div>

              {/* Role Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Role
                </label>
                <MultiSelectFilter
                  options={roleOptions}
                  value={filters.roles || []}
                  onChange={(values) => handleFilterChange('roles', values)}
                  placeholder="Pilih role"
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters({});
                  setShowAdvancedFilters(false);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filters.dateRange?.from && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Tanggal: {filters.dateRange.from.toLocaleDateString()} - {filters.dateRange.to?.toLocaleDateString()}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => handleFilterChange('dateRange', undefined)}
                />
              </Badge>
            )}
            {filters.departments?.map(dept => (
              <Badge key={dept} variant="secondary" className="flex items-center gap-1">
                {dept}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => handleFilterChange('departments', filters.departments?.filter(d => d !== dept))}
                />
              </Badge>
            ))}
            {filters.statuses?.map(status => (
              <Badge key={status} variant="secondary" className="flex items-center gap-1">
                {status}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => handleFilterChange('statuses', filters.statuses?.filter(s => s !== status))}
                />
              </Badge>
            ))}
            {filters.roles?.map(role => (
              <Badge key={role} variant="secondary" className="flex items-center gap-1">
                {role}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => handleFilterChange('roles', filters.roles?.filter(r => r !== role))}
                />
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
