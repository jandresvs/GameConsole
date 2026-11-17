# 01 · Qué pide el enunciado

Proyecto 2 de Lenguajes de Programación (TEC). Grupos de dos.

**Entrega: viernes 20 de noviembre de 2026, antes de las 10:00 pm, por el Tec Digital.**

## En una frase

Una consola web de videojuegos (GameConsole) con tres juegos orientados a
objetos, uno de ellos contra una computadora que decide con Prolog, que envía
sus eventos a GameStats y muestra las estadísticas que GameStats calcula.

## Requisitos mínimos

1. Cargar y jugar **exactamente tres** juegos distintos desde la consola web.
2. Ejecutar **varias partidas en paralelo**, en la misma consola o en pestañas separadas.
3. Juegos programados con **orientación a objetos**: clases con responsabilidades
   claras, encapsulación y abstracción.
4. Al menos un juego **usuario contra computadora**, con la decisión de la
   computadora calculada en **Prolog** (reglas o búsqueda; no movimientos al azar).
5. Eventos de inicio, desarrollo y fin de cada partida, más los propios de cada juego.
6. Eventos **compatibles con el contrato de GameStats**, enviados mientras se
   juega, también con envíos concurrentes y sin mezclar partidas.
7. Panel con estadísticas **por juego y generales**, obtenidas de GameStats.
8. Panel con la **cantidad de instancias** ejecutadas de cada juego, actualizado
   mientras la consola está en uso.
9. Instalación, ejecución integrada y deployment **reproducibles**.

## Restricciones que más importan

- La consola **no recalcula** estadísticas: solo consulta y muestra lo que devuelve GameStats.
- No se puede reemplazar el contrato de eventos por un formato incompatible.
- El envío de eventos no debe bloquear las partidas, y debe tratar los fallos de comunicación.
- Hay que poder **explicar** el algoritmo de Prolog en la demostración.

## Entregables

- Código de la consola, los tres juegos y la lógica en Prolog.
- Configuración de integración con GameStats.
- Dockerfiles, pipeline de CI/CD e instrucciones de construcción, ejecución y deployment.
- Documentación breve: uso y decisiones técnicas esenciales.
- Video de demostración (unos 15 minutos como máximo) en una plataforma pública:
  los tres juegos, la ejecución concurrente, Prolog y el panel.

Git con historial, Docker, CI/CD y deployment se piden "con un enfoque
equivalente al de GameStats".
