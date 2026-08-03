-- Corrección de DNIs truncados en docente.numero_documento (65 casos
-- encontrados el 2026-08-03, a partir de un caso reportado manualmente:
-- un docente con DNI de 7 dígitos en vez de 8).
--
-- CAUSA RAÍZ (confirmada con evidencia, no supuesta):
--   staging.stg_docente_roster.num_doc trae el mismo valor truncado que
--   docente.numero_documento, pero con sufijo ".0" (p. ej. "9508570.0")
--   -- la marca inequívoca de que en algún punto de la carga que alimentó
--   esa tabla de staging, la columna del DNI se leyó como número de punto
--   flotante en vez de como texto, perdiendo el cero inicial (los DNI
--   peruanos reales que empiezan en 0 son legítimos; numero_documento ya
--   es TEXT en el schema real justo por esto). El cero ya faltaba ANTES
--   de llegar a la tabla docente -- no es un bug introducido por el ETL
--   de encuestas (importarEncuestas.js no toca numero_documento) ni por
--   nada tocado en las sesiones de trabajo sobre carga de encuestas.
--
--   La fuente confiable que sí preserva el DNI completo (8 dígitos, con
--   el cero inicial, como texto) es frontend/public/docentes.csv --
--   evidentemente preparado con más cuidado que el roster de staging.
--
-- Ya aplicado contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-03. Este archivo lo deja versionado en el repo. Cada UPDATE
-- está guardado por id + el valor truncado exacto que tenía antes, así
-- que re-correr este archivo es un no-op si ya se aplicó (o si alguien
-- más ya corrigió esa fila por otra vía).
--
-- Lista de pendientes (23 ids sin corregir, sin evidencia suficiente):
-- ver backend/migrations/2026-08-03-dni-pendientes-verificacion.md

-- id=5   APAZA CRUZ, CARMEN ROCÍO             9508570  -> 09508570
update docente set numero_documento = '09508570' where id = 5 and numero_documento = '9508570';

-- id=6   AQUINO CAVERO, DARWIN JOSÉ EMILIO    8250659  -> 08250659
update docente set numero_documento = '08250659' where id = 6 and numero_documento = '8250659';

-- id=7   BACIGALUPO POZO, JUAN ALBERTO        7623179  -> 07623179
update docente set numero_documento = '07623179' where id = 7 and numero_documento = '7623179';

-- id=8   BANCAYAN ORÉ, CARLOS ARMANDO         9600178  -> 09600178
update docente set numero_documento = '09600178' where id = 8 and numero_documento = '9600178';

-- id=10  BEDOYA SANCHEZ, ENRIQUE OSVALDO      7248282  -> 07248282
update docente set numero_documento = '07248282' where id = 10 and numero_documento = '7248282';

-- id=11  CASTILLO MAZA, JUAN VICTORIANO       7196790  -> 07196790
update docente set numero_documento = '07196790' where id = 11 and numero_documento = '7196790';

-- id=12  CASTILLO YUI, NIEVES CECILIA         6723173  -> 06723173
update docente set numero_documento = '06723173' where id = 12 and numero_documento = '6723173';

-- id=13  CASTRO PEREZ, LUIS ALONSO            7948954  -> 07948954
update docente set numero_documento = '07948954' where id = 13 and numero_documento = '7948954';

-- id=15  CHISCUL PADILLA, MIGUEL ANGEL        7466431  -> 07466431
update docente set numero_documento = '07466431' where id = 15 and numero_documento = '7466431';

-- id=20  ESPONDA VERSACE, LAURA               7948162  -> 07948162
update docente set numero_documento = '07948162' where id = 20 and numero_documento = '7948162';

-- id=23  FIESTAS PFLUCKER, JORGE ADALBERTO    7200195  -> 07200195
update docente set numero_documento = '07200195' where id = 23 and numero_documento = '7200195';

-- id=24  FREYRE VALLADOLID, FILDA MAYELA      7961299  -> 07961299
update docente set numero_documento = '07961299' where id = 24 and numero_documento = '7961299';

-- id=25  FUCHS ANGELES, ROSA MARÍA            7759343  -> 07759343
update docente set numero_documento = '07759343' where id = 25 and numero_documento = '7759343';

-- id=28  GUZMÁN TORRES, JACOB REYNALDO        8768501  -> 08768501
update docente set numero_documento = '08768501' where id = 28 and numero_documento = '8768501';

-- id=31  IZQUIERDO CUBA, RUBÉN PAUL           9860973  -> 09860973
update docente set numero_documento = '09860973' where id = 31 and numero_documento = '9860973';

-- id=33  JAVES SANCHEZ, AUGUSTO FRANCISCO     7702664  -> 07702664
update docente set numero_documento = '07702664' where id = 33 and numero_documento = '7702664';

-- id=35  MEJIA OSORIO, AMADOR GROVER          8415595  -> 08415595
update docente set numero_documento = '08415595' where id = 35 and numero_documento = '8415595';

-- id=36  MENDOZA NAVA, ARMANDO                7973805  -> 07973805
update docente set numero_documento = '07973805' where id = 36 and numero_documento = '7973805';

-- id=37  MESIAS MENDOZA, ROCIO DEL PILAR      9443186  -> 09443186
update docente set numero_documento = '09443186' where id = 37 and numero_documento = '9443186';

-- id=38  MOLERO COCA, LUIS ALBERTO            8827879  -> 08827879
update docente set numero_documento = '08827879' where id = 38 and numero_documento = '8827879';

-- id=40  MUÑOZ MARTICORENA, WILLIAM AMADEO    8269783  -> 08269783
update docente set numero_documento = '08269783' where id = 40 and numero_documento = '8269783';

-- id=44  OYARSE CRUZ, JAVIER GUSTAVO          9553590  -> 09553590
update docente set numero_documento = '09553590' where id = 44 and numero_documento = '9553590';

-- id=45  PACHECO MARTINEZ, GUILLERMO DAVID    9371214  -> 09371214
update docente set numero_documento = '09371214' where id = 45 and numero_documento = '9371214';

-- id=48  PECCIO CHAVESTA, EDWIN MARCEL        7183532  -> 07183532
update docente set numero_documento = '07183532' where id = 48 and numero_documento = '7183532';

-- id=49  PERALTA LOAYZA, ELEAZAR FIDEL        7728244  -> 07728244
update docente set numero_documento = '07728244' where id = 49 and numero_documento = '7728244';

-- id=50  PÉREZ MAMANI, RUBENS HOUSON          791893   -> 00791893
-- *** CASO ESPECIAL ***: frontend/public/docentes.csv trae "00791893"
-- -- DOS ceros iniciales, a diferencia del patrón de un solo cero de los
-- otros 41 casos. Se aplicó igual porque es el valor real encontrado en
-- la fuente (no se inventó el dígito), pero es la única excepción al
-- patrón limpio -- requiere que alguien lo confirme contra SUNEDU/RR.HH.
-- antes de darlo por definitivo.
update docente set numero_documento = '00791893' where id = 50 and numero_documento = '791893';

-- id=52  PODESTÁ CUADROS, SERGIO FERNANDO     8066431  -> 08066431
update docente set numero_documento = '08066431' where id = 52 and numero_documento = '8066431';

-- id=56  RETTIS SALAZAR, HERMINIA TATIANA     8802901  -> 08802901
update docente set numero_documento = '08802901' where id = 56 and numero_documento = '8802901';

-- id=57  REVOLLEDO NOVOA, ÁLVARO ARTURO       8148444  -> 08148444
update docente set numero_documento = '08148444' where id = 57 and numero_documento = '8148444';

-- id=58  RÍOS BARRIENTOS, MARIO CESAR         6151890  -> 06151890
update docente set numero_documento = '06151890' where id = 58 and numero_documento = '6151890';

-- id=59  RIVAROLA GANOZA, IVAN JAVIER         7702673  -> 07702673
update docente set numero_documento = '07702673' where id = 59 and numero_documento = '7702673';

-- id=61  RONCAL VILLANUEVA, VICTOR AUGUSTO    7919101  -> 07919101
update docente set numero_documento = '07919101' where id = 61 and numero_documento = '7919101';

-- id=63  SALAS BIONDI, LUIS LEONIDAS          9419627  -> 09419627
update docente set numero_documento = '09419627' where id = 63 and numero_documento = '9419627';

-- id=64  SILVY D´ALESSIO, MYRIAM ELENA        8235524  -> 08235524
update docente set numero_documento = '08235524' where id = 64 and numero_documento = '8235524';

-- id=67  TORRES CASTILLO, ANIBAL              8677294  -> 08677294
update docente set numero_documento = '08677294' where id = 67 and numero_documento = '8677294';

-- id=70  UGARTE CASAFRANCA, WALTER DAVID      8204035  -> 08204035
update docente set numero_documento = '08204035' where id = 70 and numero_documento = '8204035';

-- id=72  VARGAS MACHUCA GUERRERO, ELIZABETH DEL PILAR  6185395 -> 06185395
update docente set numero_documento = '06185395' where id = 72 and numero_documento = '6185395';

-- id=75  VEGA DENEGRI, PATRICIA ELVIRA        9993699  -> 09993699
update docente set numero_documento = '09993699' where id = 75 and numero_documento = '9993699';

-- id=76  VELEZMORO ORMEÑO, ALVARO JOSÉ        9828650  -> 09828650
update docente set numero_documento = '09828650' where id = 76 and numero_documento = '9828650';

-- id=77  VICENTE ARMAS, EDGAR                 6003952  -> 06003952
update docente set numero_documento = '06003952' where id = 77 and numero_documento = '6003952';

-- id=79  YACOLCA ESTARES, DANIEL IRWIN        9328052  -> 09328052
update docente set numero_documento = '09328052' where id = 79 and numero_documento = '9328052';

-- id=80  ZAMORA DÍAZ, FEDERICO ARMANDO        8051234  -> 08051234
update docente set numero_documento = '08051234' where id = 80 and numero_documento = '8051234';
