:- encoding(utf8).   % primera línea: el archivo tiene tildes en los comentarios

% Servicio de inteligencia de GameConsole (SWI-Prolog).
%
%   GET  /health   -> 200 {"status":"ok"}
%   POST /route    -> ruta más corta (A*) para la CPU del juego chase
%
% El contrato de /route está en contextos/05-prolog.md. La búsqueda vive en
% route.pl; este archivo solo traduce JSON <-> términos Prolog y valida la
% petición. El servicio no guarda nada entre llamadas.
%
% Ejecutar sin Docker:   swipl server.pl        (queda en http://localhost:8082)
% Probar:                curl http://localhost:8082/health

:- use_module(library(http/http_server)).
:- use_module(library(http/http_json)).
:- use_module(library(lists)).
:- use_module(route).

:- initialization(main, main).

:- http_handler(root(health), health, [method(get)]).
:- http_handler(root(route),  route_handler,  [method(post)]).

% Límite de tamaño del tablero: protege al servicio de una petición absurda.
max_dimension(200).

health(_Request) :-
    reply_json_dict(_{status: "ok"}).

% --- POST /route ------------------------------------------------------------

route_handler(Request) :-
    catch(handle_route(Request), Error, route_error(Error)).

handle_route(Request) :-
    read_body(Request, Body),
    parse_request(Body, Rows, Cols, Obstacles, From, Goal),
    (   find_route(Rows, Cols, Obstacles, From, Goal, Steps, Turns)
    ->  length(Steps, Count),
        maplist(step_dict, Steps, Path),
        reply_json_dict(_{found: true, steps: Count, turns: Turns, path: Path})
    ;   reply_json_dict(_{found: false})
    ).

step_dict(step(Row, Col, Dir), _{row: Row, col: Col, direction: Dir}).

% Un JSON roto o que no es un objeto es una petición inválida (400).
read_body(Request, Body) :-
    catch(http_read_json_dict(Request, Body, [content_type('application/json')]),
          _, throw(bad_request("el cuerpo no es un JSON válido"))),
    (   is_dict(Body)
    ->  true
    ;   throw(bad_request("el cuerpo debe ser un objeto JSON"))
    ).

parse_request(Body, Rows, Cols, Obstacles, From, Goal) :-
    max_dimension(Max),
    dimension(Body, rows, Max, Rows),
    dimension(Body, cols, Max, Cols),
    (   get_dict(obstacles, Body, List)
    ->  (   is_list(List)
        ->  true
        ;   throw(bad_request("'obstacles' debe ser un arreglo"))
        )
    ;   List = []
    ),
    maplist(obstacle_cell(Rows, Cols), List, Obstacles),
    cell(Body, from, Rows, Cols, From),
    cell(Body, goal, Rows, Cols, Goal),
    (   memberchk(From, Obstacles)
    ->  throw(bad_request("'from' está sobre un obstáculo"))
    ;   true
    ).

dimension(Body, Key, Max, Value) :-
    (   get_dict(Key, Body, Value),
        integer(Value),
        Value >= 1,
        Value =< Max
    ->  true
    ;   throw(bad_request(format("'~w' debe ser un entero entre 1 y ~w", [Key, Max])))
    ).

cell(Body, Key, Rows, Cols, Row-Col) :-
    (   get_dict(Key, Body, Dict)
    ->  true
    ;   throw(bad_request(format("falta '~w'", [Key])))
    ),
    cell_of_dict(Key, Dict, Rows, Cols, Row-Col).

obstacle_cell(Rows, Cols, Dict, Cell) :-
    cell_of_dict(obstacles, Dict, Rows, Cols, Cell).

cell_of_dict(Name, Dict, Rows, Cols, Row-Col) :-
    (   is_dict(Dict),
        get_dict(row, Dict, Row),
        get_dict(col, Dict, Col),
        integer(Row),
        integer(Col)
    ->  true
    ;   throw(bad_request(format("'~w' debe tener 'row' y 'col' enteros", [Name])))
    ),
    (   Row >= 0, Row < Rows, Col >= 0, Col < Cols
    ->  true
    ;   throw(bad_request(format("celda fuera del tablero en '~w': (~w, ~w)", [Name, Row, Col])))
    ).

% bad_request(Mensaje) -> 400; cualquier otra cosa es un fallo nuestro (500).
route_error(bad_request(Message)) :-
    !,
    message_text(Message, Text),
    reply_json_dict(_{error: Text}, [status(400)]).
route_error(Error) :-
    print_message(error, Error),
    reply_json_dict(_{error: "error interno"}, [status(500)]).

message_text(format(Format, Args), Text) :- !, format(string(Text), Format, Args).
message_text(Text, Text).

% --- Arranque ---------------------------------------------------------------

% El puerto sale de la variable PORT; 8082 si no está definida.
port(Port) :-
    getenv('PORT', Value),
    atom_number(Value, Port),
    !.
port(8082).

main :-
    port(Port),
    http_server([port(Port)]),
    format(user_error, "prolog escuchando en el puerto ~w~n", [Port]),
    thread_get_message(_).   % el servidor atiende en otros hilos; este solo espera
