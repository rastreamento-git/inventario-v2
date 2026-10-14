import { useId } from "react";
import { RadioTower, Tag, Check } from "lucide-react";

const types = [
  {
    value: "RASTREADOR",
    label: "Rastreador",
    detail: "Equipamento de rastreamento",
    Icon: RadioTower,
  },
  {
    value: "TAG",
    label: "Tag",
    detail: "Etiqueta de identificação",
    Icon: Tag,
  },
];

export default function TipoEquipamento({ value, onChange }) {
  const id = useId();
  return (
    <fieldset className="equipment-types">
      <legend>Tipo de equipamento</legend>
      <div className="equipment-type-grid">
        {types.map(({ value: option, label, detail, Icon }) => (
          <label className="equipment-type" key={option}>
            <input
              type="radio"
              name={`equipment-type-${id}`}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span className="equipment-type-content">
              <span className="equipment-type-icon">
                <Icon size={20} />
              </span>
              <span className="equipment-type-text">
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <span className="equipment-type-check" aria-hidden="true">
                {value === option && <Check size={13} />}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
