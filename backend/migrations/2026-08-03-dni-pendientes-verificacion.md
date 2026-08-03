# DNIs pendientes de verificación manual (2026-08-03)

Contexto completo en `2026-08-03-correccion-dni-truncados.sql`. De los 65
docentes encontrados con `numero_documento` truncado (7 dígitos en vez de
8), 42 se corrigieron ahí con evidencia directa de
`frontend/public/docentes.csv`. Estos **23 quedaron sin corregir** — no se
rellenó ningún dígito a ciegas por falta de una fuente confiable.

## Con coincidencia parcial en `staging.stg_padron` (no aporta nada nuevo)

Estos 3 sí tienen una fila con el mismo nombre en `staging.stg_padron`,
pero con **el mismo número de dígitos truncado** que en `docente` — esa
fuente ya tiene el mismo problema, no permite recuperar el dígito
perdido:

| id  | nombre_completo                | numero_documento actual |
|-----|---------------------------------|--------------------------|
| 127 | ROCA BECERRA, JORGE LUIS        | 8114396                   |
| 131 | MENDOZA TORRES, CARLOS ROBERTO  | 8701208                   |
| 132 | HIDALGO EURIBE, JUANA PATRICIA  | 8756320                   |

## Sin ninguna coincidencia en ninguna fuente disponible

Sin fila coincidente por nombre en `frontend/public/docentes.csv`,
`staging.stg_padron` ni `staging.stg_docente_roster`. El rango de ids es
consecutivo y posterior a los otros 42 (que caen todos en ids ≤ 80) —
sugiere que este bloque vino de un lote de carga distinto/posterior,
fuera del alcance de las fuentes que tenemos en el repo:

| id  | nombre_completo                     | numero_documento actual |
|-----|---------------------------------------|--------------------------|
| 113 | PUELL PALACIOS, JUAN                   | 6068877                   |
| 114 | SUÁREZ NIÑO, JAVIER EDUARDO             | 6276169                   |
| 115 | JIMENEZ MURILLO, FELIX ROBERTO          | 6729495                   |
| 116 | VERGARA GARCÍA, GISELLE DEL ROCÍO       | 6779776                   |
| 118 | RAMIREZ FRANCO, ANASTACIO DARDO         | 7188309                   |
| 120 | CUBA ARANA, WILLIAM JESUS               | 7356290                   |
| 121 | CADENAS SAYÁN, VÍCTOR HUGO              | 7723773                   |
| 122 | BURGA SOLAR, ROQUE MANUEL FRANCISCO     | 7730209                   |
| 123 | MAURICIO PACHAS, PABLO WILLINS          | 7855591                   |
| 124 | CHÁVEZ DÍAZ, JORGE MIGUEL               | 7862099                   |
| 125 | OLIVEIRA BARDALES, JESSICA              | 7871125                   |
| 126 | NAVARRO VARGAS, IOSEF EDUARDO           | 7882191                   |
| 128 | ENRIQUEZ CHAVEZ, ANGELA LOURDES         | 8136596                   |
| 129 | GILES FERRER, ARTURO ANTONIO            | 8379575                   |
| 130 | VILLANUEVA CÁRDENAS, JULIO CÉSAR        | 8425711                   |
| 133 | RIVERO TERRY, JOSÉ EUGENIO              | 9139849                   |
| 134 | MELENDEZ COTRINA, ELWYN LEX             | 9301764                   |
| 135 | CABEZUDO PEREZ, YURI RAGNAR             | 9436270                   |
| 136 | CAPUÑAY REÁTEGUI, MIGUEL ANGEL          | 9541567                   |
| 137 | NOLASCO VALENZUELA, JORGE SANTIAGO      | 9668210                   |

## Cómo re-listar estos pendientes en cualquier momento

```sql
select d.id, d.nombre_completo, d.numero_documento,
       length(d.numero_documento) as longitud_actual
from docente d
join tipo_documento td on td.id = d.tipo_documento_id
where td.codigo = '1' and length(d.numero_documento) < td.longitud_min
order by d.id;
```

## Próximo paso

Alguien con acceso al padrón oficial (SUNEDU / RR.HH.) debe confirmar el
DNI completo de estos 23 docentes. Una vez confirmado, corregir con un
`UPDATE` puntual por `id` (mismo patrón que
`2026-08-03-correccion-dni-truncados.sql`), nunca rellenando un dígito
por suposición.
