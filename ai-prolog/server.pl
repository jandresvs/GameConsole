:- encoding(utf8).   % primera línea: el archivo tiene tildes en los comentarios

% Servicio de inteligencia de GameConsole (SWI-Prolog).
%
% Por ahora es el esqueleto: solo responde GET /health, para que el compose y
% el proxy de la consola tengan con quién hablar. La búsqueda de rutas (A*)
% para el juego chase va aquí; el contrato propuesto está en
% contextos/05-prolog.md.
%
% Ejecutar sin Docker:   swipl server.pl        (queda en http://localhost:8082)
% Probar:                curl http://localhost:8082/health

:- use_module(library(http/http_server)).
:- use_module(library(http/http_json)).

:- initialization(main, main).

:- http_handler(root(health), health, [method(get)]).

health(_Request) :-
    reply_json_dict(_{status: "ok"}).

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
