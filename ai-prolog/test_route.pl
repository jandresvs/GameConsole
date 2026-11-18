:- encoding(utf8).

% Pruebas de la búsqueda de rutas (route.pl).
%
%   swipl -g run_tests -t halt test_route.pl
%
% Además de casos puntuales, compara contra una búsqueda por fuerza bruta en
% tableros aleatorios pequeños: el A* debe dar el mismo número de pasos y el
% mismo mínimo de giros que revisar todos los caminos más cortos.

:- use_module(library(plunit)).
:- use_module(library(lists)).
:- use_module(library(random)).
:- use_module(route).

:- begin_tests(route).

test(origen_igual_a_meta) :-
    find_route(3, 3, [], 1-1, 1-1, Steps, Turns),
    Steps == [], Turns == 0.

test(linea_recta_sin_giros) :-
    find_route(1, 5, [], 0-0, 0-4, Steps, Turns),
    length(Steps, 4), Turns == 0,
    Steps = [step(0, 1, derecha)|_].

test(un_giro) :-
    find_route(5, 5, [], 0-0, 2-3, Steps, Turns),
    length(Steps, 5), Turns == 1.

test(el_camino_no_incluye_el_origen) :-
    find_route(3, 3, [], 0-0, 0-2, Steps, _),
    \+ memberchk(step(0, 0, _), Steps).

test(rodea_un_obstaculo) :-
    find_route(3, 3, [1-1], 1-0, 1-2, Steps, _),
    length(Steps, 4),
    \+ memberchk(step(1, 1, _), Steps).

test(sin_ruta, [fail]) :-
    find_route(3, 3, [0-1, 1-0, 1-1], 0-0, 2-2, _, _).

test(meta_sobre_obstaculo, [fail]) :-
    find_route(3, 3, [2-2], 0-0, 2-2, _, _).

test(obstaculos_repetidos_no_rompen) :-
    find_route(3, 3, [1-1, 1-1], 1-0, 1-2, Steps, _),
    length(Steps, 4).

test(prefiere_menos_giros) :-
    % Hay muchas rutas de 8 pasos entre las esquinas; la de menos giros tiene 1.
    find_route(5, 5, [], 0-0, 4-4, Steps, Turns),
    length(Steps, 8), Turns == 1.

test(es_determinista) :-
    findall(S, find_route(6, 6, [2-2, 3-3], 0-0, 5-5, S, _), All),
    All = [First|_],
    forall(member(S, All), S == First).

test(contra_fuerza_bruta, [true(Bad == [])]) :-
    set_random(seed(2026)),
    findall(Case,
            ( between(1, 150, _), random_case(5, 5, Case) ),
            Cases),
    include(disagrees, Cases, Bad).

:- end_tests(route).

% --- Referencia por fuerza bruta -------------------------------------------

random_case(Rows, Cols, case(Rows, Cols, Obstacles, From, Goal)) :-
    NCells is Rows * Cols,
    findall(R-C, (between(1, Rows, R0), R is R0-1, between(1, Cols, C0), C is C0-1), Cells),
    random_permutation(Cells, [From, Goal|Rest]),
    random_between(0, 9, NObs),
    length(Obstacles, NObs),
    NObs =< NCells - 2,
    append(Obstacles, _, Rest).

disagrees(case(Rows, Cols, Obstacles, From, Goal)) :-
    (   find_route(Rows, Cols, Obstacles, From, Goal, Steps, Turns)
    ->  length(Steps, Len),
        brute(Rows, Cols, Obstacles, From, Goal, BLen, BTurns),
        ( Len =:= BLen, Turns =:= BTurns, valid_path(Obstacles, Rows, Cols, From, Goal, Steps) -> fail ; true )
    ;   brute(Rows, Cols, Obstacles, From, Goal, _, _)   % A* dijo "sin ruta" y sí había
    ).

% Mínimo de pasos y, entre los caminos de ese largo, mínimo de giros.
brute(Rows, Cols, Obstacles, From, Goal, Len, Turns) :-
    between(0, 25, Len),
    findall(T, path_turns(Rows, Cols, Obstacles, From, Goal, Len, T), Ts),
    Ts \== [], !,
    min_list(Ts, Turns).

path_turns(Rows, Cols, Obstacles, From, Goal, Len, Turns) :-
    walk(Rows, Cols, Obstacles, From, Goal, Len, none, [From], 0, Turns).

walk(_, _, _, Goal, Goal, 0, _, _, T, T) :- !.
walk(Rows, Cols, Obstacles, R-C, Goal, Left, Prev, Seen, T0, T) :-
    Left > 0,
    member(D-(DR-DC), [arriba-(-1-0), abajo-(1-0), izquierda-(0-(-1)), derecha-(0-1)]),
    NR is R + DR, NC is C + DC,
    NR >= 0, NR < Rows, NC >= 0, NC < Cols,
    \+ memberchk(NR-NC, Obstacles),
    \+ memberchk(NR-NC, Seen),
    ( Prev == none -> Add = 0 ; Prev == D -> Add = 0 ; Add = 1 ),
    T1 is T0 + Add,
    Left1 is Left - 1,
    walk(Rows, Cols, Obstacles, NR-NC, Goal, Left1, D, [NR-NC|Seen], T1, T).

% El camino devuelto debe ser contiguo, sin obstáculos y terminar en la meta.
valid_path(Obstacles, Rows, Cols, From, Goal, Steps) :-
    valid_from(Steps, From, Obstacles, Rows, Cols, Last),
    Last == Goal.

valid_from([], Last, _, _, _, Last).
valid_from([step(R, C, _)|Rest], R0-C0, Obstacles, Rows, Cols, Last) :-
    abs(R - R0) + abs(C - C0) =:= 1,
    R >= 0, R < Rows, C >= 0, C < Cols,
    \+ memberchk(R-C, Obstacles),
    valid_from(Rest, R-C, Obstacles, Rows, Cols, Last).
