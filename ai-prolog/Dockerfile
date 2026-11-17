# Imagen oficial de SWI-Prolog (incluye las librerías HTTP y JSON).
FROM swipl:stable
WORKDIR /app
COPY server.pl .
ENV PORT=8082 LANG=C.UTF-8
EXPOSE 8082
CMD ["swipl", "server.pl"]
