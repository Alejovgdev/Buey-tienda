export default function Propietarios() {
  const owners = [
    {
      name: "Josep Roca",
      title: "Owner",
      image: "/assets/images/josep.jpeg",
    },
    {
      name: "Miguel Arcos",
      title: "Owner",
      image: "/assets/images/miguel.jpeg",
    },
  ];

  return (
    <section className="w-full py-12 md:py-16 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-12 md:mb-14">
          <h2 className="text-4xl md:text-5xl font-heading text-amber-300 mb-10">
            Nuestros Propietarios
          </h2>
            <p className="text-gray-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Los fundadores de <span className="text-amber-300 font-semibold">El Buey Madurado</span>. Dos personas con una pasión muy
              clara por la carne y por hacer las cosas bien. De esa idea nace un espacio donde el producto, el tiempo y el
              cuidado en cada detalle marcan la diferencia.
            </p>
        </div>

        {/* Grid Responsive - 1 col en mobile, 2 en desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-10 lg:gap-16 mb-16">
          {owners.map((owner) => (
            <div
              key={owner.name}
              className="group flex flex-col items-center md:items-start"
            >
              {/* Contenedor de imagen con efecto */}
              <div className="relative mb-8 overflow-hidden w-full max-w-xs">
                {/* Imagen principal */}
                <div className="relative w-full aspect-[2.5/2.5] rounded-lg overflow-hidden shadow-xl">
                  <img
                    src={owner.image}
                    alt={owner.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />

                  {/* Overlay con degradado sutil */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-30 group-hover:opacity-50 transition-opacity duration-500" />

                  {/* Borde dorado sutil */}
                  <div className="absolute inset-0 border border-amber-300/20 rounded-lg" />
                </div>

                {/* Línea decorativa bajo la imagen */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-300/0 via-amber-300 to-amber-300/0" />
              </div>                {/* Información del propietario */}
              <div className="flex flex-col w-full md:w-auto text-center md:text-left">
                {/* Nombre */}
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors duration-300">
                  {owner.name}
                </h3>

                {/* Título/Rol */}
                <p className="text-amber-300 text-sm md:text-base font-semibold mb-4 tracking-wide">
                  {owner.title}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Sección de cierre - Filosofía */}
        <div className="border-t border-amber-900/30 pt-12 md:pt-16">
          <p className="text-center text-gray-300 text-sm md:text-base max-w-3xl mx-auto leading-relaxed">
            Cada detalle, cada corte, cada proceso de maduración refleja nuestro
            <span className="text-amber-300 font-semibold"> compromiso inquebrantable </span>
            con la calidad y la tradición.
            Bienvenido a El Buey Madurado.
          </p>
        </div>
      </div>
    </section>
  );
}