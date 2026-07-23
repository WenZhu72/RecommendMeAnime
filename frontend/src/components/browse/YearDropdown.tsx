import { SearchableSelectDropdown } from "@/components/browse/SearchableSelectDropdown";
import { BROWSE_YEARS } from "@/config/catalogue";
import { toggleBrowseYear } from "@/lib/browse-path";

type YearDropdownProps = {
  value: string;
  onChange: (year: string) => void;
  disabled?: boolean;
};

const YEAR_OPTIONS = BROWSE_YEARS.map(String);

export function YearDropdown({ value, onChange, disabled = false }: YearDropdownProps) {
  return (
    <SearchableSelectDropdown
      selectionMode="single"
      label="Year"
      pluralLabel="years"
      ariaLabel={value ? `Release year: ${value}` : "Release year: All years"}
      options={YEAR_OPTIONS}
      selected={value}
      onChange={(selectedYear) => onChange(toggleBrowseYear(value, selectedYear))}
      disabled={disabled}
      inputMode="numeric"
      normalizeQuery={(query) => query.replace(/\D/g, "").slice(0, 4)}
      searchPlaceholder="Find a year"
      searchAriaLabel="Search release years"
      emptyMessage="No matching years"
    />
  );
}
