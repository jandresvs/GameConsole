:- encoding(utf8).   % primera línea: el archivo tiene tildes en los comentarios

% Búsqueda de rutas para el juego chase (lógica pura, sin HTTP).
%
% Adaptado del A* del proyecto Java + Prolog (ruta.pl). Cambios principales:
%   * El estado de la búsqueda es (celda, dirección de llegada), no solo la celda.
%     Así el desempate por giros es exacto: entre las rutas más cortas siempre
%     se devuelve una con el mínimo de giros posible.
%   * La lista abierta es un heap (library(heaps)) y los costos viven en un árbol
%     (library(assoc)); la versión original reordenaba la lista completa en cada
%     paso, que se vuelve lenta en tableros grandes.
%   * No usa assert/retract: todo el estado vive en los argumentos, así que varias
%     peticiones simultáneas (hilos del servidor) no se pueden mezclar.
%
% Coordenadas: Row-Col, desde 0. Direcciones: arriba, abajo, izquierda, derecha.
%
% Costo de un camino = (pasos, giros), comparado en ese orden:
%   1. menos pasos (A* con distancia Manhattan, que nunca sobrestima en una
%      cuadrícula de cuatro direcciones, así que el resultado es óptimo);
%   2. entre las igual de cortas, menos giros (un giro es cambiar de dirección
%      respecto al paso anterior; el primer paso no cuenta como giro).

:- module(route, [find_route/7]).

:- use_module(library(assoc)).
:- use_module(library(heaps)).
:- use_module(library(lists)).

% dir(Nombre, DeltaFila, DeltaColumna). El orden fija el desempate final
% (resultado determinista cuando hay empate total).
dir(arriba,    -1,  0).
dir(abajo,      1,  0).
dir(izquierda,  0, -1).
dir(derecha,    0,  1).

%! find_route(+Rows, +Cols, +Obstacles, +From, +Goal, -Steps, -Turns) is semidet.
%
%  Obstacles es una lista de Row-Col (puede traer repetidos). Steps es la lista
%  de step(Row, Col, Direction) de cada celda recorrida, SIN la celda de origen.
%  Falla si no existe ruta.
find_route(Rows, Cols, Obstacles, From, Goal, Steps, Turns) :-
    obstacle_set(Obstacles, Blocked),
    \+ blocked(Blocked, Goal),
    manhattan(From, Goal, H0),
    list_to_heap([], Empty),
    State0 = state(From, none),
    add_to_heap(Empty, k(H0, 0, 0), node(From, none, 0, 0, []), Open0),
    list_to_assoc([State0-cost(0, 0)], Best0),
    ctx(Rows, Cols, Blocked, Goal, Ctx),
    astar(Open0, Best0, Ctx, Steps, Turns).

ctx(Rows, Cols, Blocked, Goal, ctx(Rows, Cols, Blocked, Goal)).

obstacle_set(Obstacles, Set) :-
    sort(Obstacles, Unique),
    findall(O-true, member(O, Unique), Pairs),
    list_to_assoc(Pairs, Set).

blocked(Set, Cell) :- get_assoc(Cell, Set, _).

manhattan(R1-C1, R2-C2, H) :-
    H is abs(R1 - R2) + abs(C1 - C2).

turn(none, _, 0) :- !.
turn(D, D, 0)    :- !.
turn(_, _, 1).

% --- Búsqueda ---------------------------------------------------------------
% Un nodo es node(Celda, DirLlegada, Pasos, Giros, CaminoInverso).
% Prioridad del heap: k(F, Giros, -Pasos) con F = Pasos + Manhattan. Entre
% nodos con el mismo F y los mismos giros se expande primero el más profundo.

astar(Open0, Best, Ctx, Steps, Turns) :-
    get_from_heap(Open0, _Key, node(Pos, Dir, G, T, Rev), Open1),
    Ctx = ctx(_, _, _, Goal),
    (   stale(Best, Pos, Dir, G, T)
    ->  astar(Open1, Best, Ctx, Steps, Turns)       % entrada vieja: ya hubo algo mejor
    ;   Pos == Goal
    ->  reverse(Rev, Steps),                         % la primera meta que sale del heap es la óptima
        Turns = T
    ;   expand(Pos, Dir, G, T, Rev, Ctx, Open1, Best, Open2, Best2),
        astar(Open2, Best2, Ctx, Steps, Turns)
    ).

stale(Best, Pos, Dir, G, T) :-
    get_assoc(state(Pos, Dir), Best, cost(BG, BT)),
    (G-T) \== (BG-BT).

expand(R-C, Dir, G, T, Rev, Ctx, Open0, Best0, Open, Best) :-
    Ctx = ctx(Rows, Cols, Blocked, Goal),
    G1 is G + 1,
    findall(D-(NR-NC),
            ( dir(D, DR, DC),
              NR is R + DR,
              NC is C + DC,
              NR >= 0, NR < Rows,
              NC >= 0, NC < Cols,
              \+ blocked(Blocked, NR-NC)
            ),
            Neighbors),
    push_all(Neighbors, Dir, G1, T, Rev, Goal, Open0, Best0, Open, Best).

push_all([], _, _, _, _, _, Open, Best, Open, Best).
push_all([D-Pos|Rest], PrevDir, G1, T, Rev, Goal, Open0, Best0, Open, Best) :-
    turn(PrevDir, D, Turn),
    T1 is T + Turn,
    State = state(Pos, D),
    (   get_assoc(State, Best0, cost(OG, OT)),
        (OG-OT) @=< (G1-T1)
    ->  Open1 = Open0, Best1 = Best0                 % ya lo alcanzamos igual o mejor
    ;   manhattan(Pos, Goal, H),
        F is G1 + H,
        NegG is -G1,
        Pos = NR-NC,
        add_to_heap(Open0, k(F, T1, NegG), node(Pos, D, G1, T1, [step(NR, NC, D)|Rev]), Open1),
        put_assoc(State, Best0, cost(G1, T1), Best1)
    ),
    push_all(Rest, PrevDir, G1, T, Rev, Goal, Open1, Best1, Open, Best).
