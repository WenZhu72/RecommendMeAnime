import { SearchableSelectDropdown } from "@/components/browse/SearchableSelectDropdown";
import { ANIME_GENRES } from "@/config/catalogue";

type GenreDropdownProps = {
  selected: string[];
  onChange: (genres: string[]) => void;
  disabled?: boolean;
};

export function GenreDropdown({ selected, onChange, disabled = false }: GenreDropdownProps) {
  return (
    <SearchableSelectDropdown
      selectionMode="multiple"
      label="Genre"
      pluralLabel="genres"
      options={ANIME_GENRES}
      selected={selected}
      onChange={onChange}
      disabled={disabled}
      searchPlaceholder="Find a genre"
      searchAriaLabel="Search genres"
      emptyMessage="No matching genres"
    />
  );
}
